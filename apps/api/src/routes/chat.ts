/**
 * Chat API Routes
 * Module-scoped chat with RAG
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { logger } from '../utils/logger.js';

interface ChatMessageBody {
  message: string;
  conversationId?: string;
  sessionId: string;
  userId?: string;
}

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();

  /**
   * Send a message to module chat
   */
  fastify.post('/chat/:moduleId/message', async (request: FastifyRequest<{ Params: { moduleId: string }; Body: ChatMessageBody }>, reply: FastifyReply) => {
    const { moduleId } = request.params;
    const { message, conversationId, sessionId, userId } = request.body;

    // Verify module exists
    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    // Get chat config
    const chatConfig = await db.query.chatConfigs.findFirst({
      where: eq(schema.chatConfigs.moduleId, module.id),
    });

    if (!chatConfig || !chatConfig.active) {
      return reply.status(400).send({
        success: false,
        error: 'Chat not configured for this module',
      });
    }

    const msgConversationId = conversationId || `conv-${nanoid(10)}`;
    const messageId = `msg-${nanoid(10)}`;

    // Store user message
    await db.insert(schema.chatMessages).values({
      messageId,
      moduleId: module.id,
      conversationId: msgConversationId,
      role: 'user',
      content: message,
      sessionId,
      userId,
    });

    // TODO: Process message through chat service with RAG
    // For now, return a placeholder response

    const responseMessageId = `msg-${nanoid(10)}`;
    const responseContent = `Thank you for your question about the training module. This is a placeholder response. The full RAG-powered chat will provide context-aware answers based on the training materials.`;

    // Store assistant message
    await db.insert(schema.chatMessages).values({
      messageId: responseMessageId,
      moduleId: module.id,
      conversationId: msgConversationId,
      role: 'assistant',
      content: responseContent,
      sessionId,
    });

    logger.info('Chat message processed', {
      moduleId,
      conversationId: msgConversationId,
      messageId,
    });

    return reply.send({
      success: true,
      data: {
        messageId: responseMessageId,
        conversationId: msgConversationId,
        content: responseContent,
        citations: [],
        timestamp: new Date().toISOString(),
      },
    });
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
}
