/**
 * Chat API Routes
 * Module-scoped chat with RAG
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { ChatService, InMemoryVectorStore, createDefaultPolicy } from '@learnglobal/chat';
import { createLLMProvider } from '@learnglobal/llm';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../config.js';

interface ChatMessageBody {
  message: string;
  conversationId?: string;
  sessionId: string;
  userId?: string;
}

// Cache chat services per module
const chatServices = new Map<string, ChatService>();
const vectorStores = new Map<string, InMemoryVectorStore>();

/**
 * Get or create a ChatService for a module
 */
async function getChatService(moduleId: string, db: ReturnType<typeof getDatabase>): Promise<ChatService | null> {
  // Check cache
  if (chatServices.has(moduleId)) {
    return chatServices.get(moduleId)!;
  }

  const config = loadConfig();

  // Get module and its chat config
  const module = await db.query.modules.findFirst({
    where: eq(schema.modules.moduleId, moduleId),
  });

  if (!module) {
    return null;
  }

  const chatConfig = await db.query.chatConfigs.findFirst({
    where: eq(schema.chatConfigs.moduleId, module.id),
  });

  if (!chatConfig || !chatConfig.active) {
    return null;
  }

  // Get the latest completed run to load content for RAG
  const latestRun = await db.query.runs.findFirst({
    where: eq(schema.runs.moduleId, module.id),
    orderBy: (runs, { desc }) => [desc(runs.completedAt)],
    with: {
      artifacts: true,
    },
  });

  // Create vector store and index content
  const vectorStore = new InMemoryVectorStore();
  vectorStores.set(moduleId, vectorStore);

  if (latestRun?.artifacts) {
    const documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }> = [];

    for (const artifact of latestRun.artifacts) {
      if (artifact.artifactType === 'sourcepack' && artifact.data) {
        const sourcePack = artifact.data as any;

        // Index each section of the source pack
        if (sourcePack.sections) {
          for (const section of sourcePack.sections) {
            documents.push({
              id: `${moduleId}-${section.id}`,
              content: section.content,
              metadata: {
                sourceName: section.title,
                section: section.id,
                type: 'section',
              },
            });

            // Index scenarios
            if (section.scenarios) {
              for (const scenario of section.scenarios) {
                documents.push({
                  id: `${moduleId}-scenario-${scenario.scenarioId}`,
                  content: scenario.content,
                  metadata: {
                    sourceName: scenario.title,
                    section: section.id,
                    type: 'scenario',
                  },
                });
              }
            }
          }
        }

        // Index embedded artifacts
        if (sourcePack.embeddedArtifacts) {
          for (const artifact of sourcePack.embeddedArtifacts) {
            documents.push({
              id: `${moduleId}-artifact-${artifact.id}`,
              content: JSON.stringify(artifact.content),
              metadata: {
                sourceName: artifact.title,
                type: artifact.type,
              },
            });
          }
        }
      }
    }

    if (documents.length > 0) {
      await vectorStore.index(documents);
      logger.info('Indexed documents for chat', { moduleId, count: documents.length });
    }
  }

  // Create LLM provider
  const llmProvider = createLLMProvider({
    provider: 'openai',
    apiKey: config.openai.apiKey,
    model: config.openai.model,
    maxRetries: config.openai.maxRetries,
  });

  // Create default policy from chat config
  const policyConfig = chatConfig.policyConfig as any || {};
  const policy = createDefaultPolicy(
    moduleId,
    module.vertical,
    policyConfig.scopeOfAdvice || `Training content for ${module.title}`,
    policyConfig.prohibitedTopics || [],
    policyConfig.disclaimers || []
  );

  // Create chat service
  const chatService = new ChatService({
    llmProvider,
    vectorStore,
    defaultPolicy: policy,
  });

  chatServices.set(moduleId, chatService);
  return chatService;
}

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();

  /**
   * Send a message to module chat
   */
  fastify.post('/chat/:moduleId/message', async (request: FastifyRequest<{ Params: { moduleId: string }; Body: ChatMessageBody }>, reply: FastifyReply) => {
    const { moduleId } = request.params;
    const { message, conversationId, sessionId, userId } = request.body;

    // Get or create chat service
    const chatService = await getChatService(moduleId, db);

    if (!chatService) {
      return reply.status(400).send({
        success: false,
        error: 'Chat not configured for this module',
      });
    }

    const msgConversationId = conversationId || `conv-${nanoid(10)}`;

    // Get module for database operations
    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    // Store user message
    const userMessageId = `msg-${nanoid(10)}`;
    await db.insert(schema.chatMessages).values({
      messageId: userMessageId,
      moduleId: module.id,
      conversationId: msgConversationId,
      role: 'user',
      content: message,
      sessionId,
      userId,
    });

    try {
      // Process message through chat service with RAG
      const response = await chatService.processMessage({
        moduleId,
        message,
        conversationId: msgConversationId,
        sessionId,
        userId,
      });

      // Store assistant message
      await db.insert(schema.chatMessages).values({
        messageId: response.messageId,
        moduleId: module.id,
        conversationId: msgConversationId,
        role: 'assistant',
        content: response.content,
        sessionId,
        metadata: {
          citations: response.citations,
          tokenUsage: response.tokenUsage,
        },
      });

      logger.info('Chat message processed', {
        moduleId,
        conversationId: msgConversationId,
        messageId: response.messageId,
        citationCount: response.citations.length,
      });

      return reply.send({
        success: true,
        data: {
          messageId: response.messageId,
          conversationId: response.conversationId,
          content: response.content,
          citations: response.citations,
          timestamp: response.timestamp,
        },
      });
    } catch (error) {
      logger.error('Chat processing failed', {
        moduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return a fallback response
      const fallbackMessageId = `msg-${nanoid(10)}`;
      const fallbackContent = "I apologize, but I'm having trouble processing your question right now. Please try again or rephrase your question.";

      await db.insert(schema.chatMessages).values({
        messageId: fallbackMessageId,
        moduleId: module.id,
        conversationId: msgConversationId,
        role: 'assistant',
        content: fallbackContent,
        sessionId,
        metadata: { error: true },
      });

      return reply.send({
        success: true,
        data: {
          messageId: fallbackMessageId,
          conversationId: msgConversationId,
          content: fallbackContent,
          citations: [],
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * Get chat configuration for a module
   */
  fastify.get('/chat/:moduleId/config', async (request: FastifyRequest<{ Params: { moduleId: string } }>, reply: FastifyReply) => {
    const { moduleId } = request.params;

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    const chatConfig = await db.query.chatConfigs.findFirst({
      where: eq(schema.chatConfigs.moduleId, module.id),
    });

    if (!chatConfig) {
      return reply.status(404).send({
        success: false,
        error: 'Chat not configured for this module',
      });
    }

    return reply.send({
      success: true,
      data: {
        configId: chatConfig.configId,
        policyId: chatConfig.policyId,
        active: chatConfig.active,
        features: chatConfig.features,
      },
    });
  });

  /**
   * Get conversation history
   */
  fastify.get('/chat/:moduleId/conversations/:conversationId', async (request: FastifyRequest<{ Params: { moduleId: string; conversationId: string } }>, reply: FastifyReply) => {
    const { moduleId, conversationId } = request.params;

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    const messages = await db.query.chatMessages.findMany({
      where: eq(schema.chatMessages.conversationId, conversationId),
      orderBy: schema.chatMessages.timestamp,
    });

    return reply.send({
      success: true,
      data: messages,
    });
  });

  /**
   * Submit feedback for a message
   */
  fastify.post('/chat/:moduleId/messages/:messageId/feedback', async (request: FastifyRequest<{ Params: { moduleId: string; messageId: string }; Body: { rating: 'positive' | 'negative'; comment?: string } }>, reply: FastifyReply) => {
    const { messageId } = request.params;
    const { rating, comment } = request.body;

    const message = await db.query.chatMessages.findFirst({
      where: eq(schema.chatMessages.messageId, messageId),
    });

    if (!message) {
      return reply.status(404).send({
        success: false,
        error: 'Message not found',
      });
    }

    await db.update(schema.chatMessages)
      .set({
        feedback: {
          rating,
          comment,
          timestamp: new Date().toISOString(),
        },
      })
      .where(eq(schema.chatMessages.messageId, messageId));

    logger.info('Chat feedback submitted', { messageId, rating });

    return reply.send({
      success: true,
    });
  });

  /**
   * Refresh chat index (re-index documents)
   */
  fastify.post('/chat/:moduleId/refresh', async (request: FastifyRequest<{ Params: { moduleId: string } }>, reply: FastifyReply) => {
    const { moduleId } = request.params;

    // Clear cached service to force re-initialization
    chatServices.delete(moduleId);
    vectorStores.delete(moduleId);

    // Re-initialize
    const chatService = await getChatService(moduleId, db);

    if (!chatService) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to refresh chat service',
      });
    }

    return reply.send({
      success: true,
      message: 'Chat index refreshed',
    });
  });
}
