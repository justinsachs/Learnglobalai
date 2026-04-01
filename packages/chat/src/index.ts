/**
 * @learnglobal/chat
 *
 * Module-scoped chat with RAG retrieval and policy guardrails
 */

import { nanoid } from 'nanoid';
import type {
  ChatConfig,
  ChatPolicy,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  RetrievedChunk,
} from '@learnglobal/contracts';
import type { LLMProvider, TokenUsage } from '@learnglobal/llm';

export interface ChatServiceConfig {
  llmProvider: LLMProvider;
  vectorStore: VectorStore;
  defaultPolicy: ChatPolicy;
}

export interface VectorStore {
  index(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): Promise<number>;
  search(query: string, limit: number): Promise<RetrievedChunk[]>;
  delete(ids: string[]): Promise<void>;
}

/**
 * In-memory vector store for development
 * In production, use pgvector or Pinecone
 */
export class InMemoryVectorStore implements VectorStore {
  private documents: Map<string, { content: string; metadata?: Record<string, unknown> }> = new Map();

  async index(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): Promise<number> {
    for (const doc of documents) {
      this.documents.set(doc.id, { content: doc.content, metadata: doc.metadata });
    }
    return documents.length;
  }

  async search(query: string, limit: number): Promise<RetrievedChunk[]> {
    // Simple keyword matching for development
    // Production would use actual vector similarity
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scores: Array<{ id: string; content: string; score: number; metadata?: Record<string, unknown> }> = [];

    for (const [id, doc] of this.documents) {
      const contentLower = doc.content.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores.push({ id, content: doc.content, score: score / queryTerms.length, metadata: doc.metadata });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        sourceId: s.id,
        sourceName: (s.metadata?.sourceName as string) || 'Unknown',
        content: s.content.substring(0, 500),
        score: s.score,
        metadata: {
          section: s.metadata?.section as string,
        },
      }));
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }
}

/**
 * Policy Engine for chat guardrails
 */
export class PolicyEngine {
  private policy: ChatPolicy;

  constructor(policy: ChatPolicy) {
    this.policy = policy;
  }

  /**
   * Check if message violates policy
   */
  checkMessage(message: string): { allowed: boolean; violations: string[]; action?: string } {
    const violations: string[] = [];
    const messageLower = message.toLowerCase();

    // Check prohibited topics
    for (const topic of this.policy.prohibitedTopics) {
      if (messageLower.includes(topic.toLowerCase())) {
        violations.push(`Prohibited topic: ${topic}`);
      }
    }

    // Check escalation triggers
    for (const trigger of this.policy.escalationTriggers) {
      for (const pattern of trigger.patterns) {
        if (messageLower.includes(pattern.toLowerCase())) {
          return {
            allowed: false,
            violations: [`Escalation trigger: ${trigger.condition}`],
            action: trigger.action,
          };
        }
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
    };
  }

  /**
   * Get refusal template for a violation type
   */
  getRefusalTemplate(violationType: string): string {
    const template = this.policy.refusalTemplates.find((t) =>
      t.triggerCondition.toLowerCase().includes(violationType.toLowerCase())
    );
    return template?.message || this.policy.lowConfidenceResponse;
  }

  /**
   * Check if topic is allowed
   */
  isTopicAllowed(topic: string): boolean {
    const topicLower = topic.toLowerCase();
    return this.policy.allowedTopics.some((t) =>
      t.keywords.some((k) => topicLower.includes(k.toLowerCase()))
    );
  }

  /**
   * Get required disclaimers
   */
  getDisclaimers(): string[] {
    return this.policy.responseDisclaimers;
  }
}

/**
 * Chat Service for module-scoped conversations
 */
export class ChatService {
  private config: ChatServiceConfig;
  private policyEngine: PolicyEngine;
  private conversations: Map<string, ChatMessage[]> = new Map();

  constructor(config: ChatServiceConfig) {
    this.config = config;
    this.policyEngine = new PolicyEngine(config.defaultPolicy);
  }

  /**
   * Process a chat message
   */
  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    const conversationId = request.conversationId || nanoid();
    const messageId = nanoid();

    // Check policy
    const policyCheck = this.policyEngine.checkMessage(request.message);
    if (!policyCheck.allowed) {
      const refusal = this.policyEngine.getRefusalTemplate(policyCheck.violations[0]);
      return {
        messageId,
        conversationId,
        content: refusal,
        citations: [],
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        timestamp: new Date().toISOString(),
      };
    }

    // Retrieve relevant context
    const context = await this.config.vectorStore.search(request.message, 5);

    // Build conversation history
    const history = this.conversations.get(conversationId) || [];

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context);

    // Build messages for LLM
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: request.message },
    ];

    // Generate response
    const { content, usage } = await this.config.llmProvider.complete(messages, {
      maxTokens: 1000,
      temperature: 0.3,
    });

    // Extract citations from response
    const citations = this.extractCitations(content, context);

    // Store messages
    const userMessage: ChatMessage = {
      id: nanoid(),
      moduleId: request.moduleId,
      conversationId,
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      id: messageId,
      moduleId: request.moduleId,
      conversationId,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      retrievedContext: context,
      citations,
      tokenUsage: usage,
    };

    const updatedHistory = [...history, userMessage, assistantMessage];
    this.conversations.set(conversationId, updatedHistory);

    return {
      messageId,
      conversationId,
      content,
      citations,
      tokenUsage: usage,
      timestamp: assistantMessage.timestamp,
    };
  }

  private buildSystemPrompt(context: RetrievedChunk[]): string {
    const policy = this.config.defaultPolicy;
    const contextText = context.map((c) => `[${c.sourceName}]: ${c.content}`).join('\n\n');

    return `You are a helpful training assistant for ${policy.name}.

SCOPE OF ADVICE:
${policy.scopeOfAdvice}

GUIDELINES:
- Answer questions based on the provided context
- If you're not sure or the information isn't in the context, say so
- Always cite your sources when making claims
- ${policy.requireCitations ? 'Include citations for all factual claims' : 'Include citations when helpful'}

PROHIBITED:
${policy.prohibitedTopics.map((t) => `- Do not discuss: ${t}`).join('\n')}

DISCLAIMERS TO INCLUDE WHEN RELEVANT:
${policy.responseDisclaimers.map((d) => `- ${d}`).join('\n')}

CONTEXT FROM TRAINING MATERIALS:
${contextText || 'No specific context available for this question.'}

Respond helpfully while staying within the defined scope.`;
  }

  private extractCitations(
    response: string,
    context: RetrievedChunk[]
  ): Array<{ sourceId: string; sourceName: string; excerpt: string }> {
    // Simple citation extraction based on context relevance
    const citations: Array<{ sourceId: string; sourceName: string; excerpt: string }> = [];
    const responseLower = response.toLowerCase();

    for (const chunk of context) {
      // Check if the response likely uses content from this chunk
      const chunkTerms = chunk.content.toLowerCase().split(/\s+/).slice(0, 10);
      const matchCount = chunkTerms.filter((term) => responseLower.includes(term)).length;

      if (matchCount > 3) {
        citations.push({
          sourceId: chunk.sourceId,
          sourceName: chunk.sourceName,
          excerpt: chunk.content.substring(0, 100) + '...',
        });
      }
    }

    return citations.slice(0, 3);
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ChatMessage[] {
    return this.conversations.get(conversationId) || [];
  }

  /**
   * Update policy
   */
  updatePolicy(policy: ChatPolicy): void {
    this.policyEngine = new PolicyEngine(policy);
  }
}

/**
 * Create chat configuration for a module
 */
export function createChatConfig(
  moduleId: string,
  runId: string,
  policy: ChatPolicy
): ChatConfig {
  return {
    id: nanoid(),
    moduleId,
    runId,
    policyId: policy.id,
    retrievalIndexId: `idx-${moduleId}`,
    sources: [],
    systemPromptTemplate: '',
    modelConfig: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 1000,
    },
    features: {
      streamingEnabled: false,
      historyEnabled: true,
      feedbackEnabled: true,
      suggestionsEnabled: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    active: true,
  };
}

/**
 * Create default chat policy for a vertical
 */
export function createDefaultPolicy(
  moduleId: string,
  vertical: string,
  scopeOfAdvice: string,
  prohibitedTopics: string[] = [],
  disclaimers: string[] = []
): ChatPolicy {
  return {
    id: `policy-${moduleId}`,
    moduleId,
    version: '1.0.0',
    name: `${vertical} Training Assistant`,
    description: `Chat assistant for ${vertical} training module`,
    allowedTopics: [
      {
        id: 'training-content',
        name: 'Training Content',
        description: 'Questions about the training material',
        keywords: ['training', 'learn', 'module', 'section', 'topic'],
        requireCitations: true,
      },
      {
        id: 'procedures',
        name: 'Procedures',
        description: 'Questions about procedures and processes',
        keywords: ['procedure', 'process', 'step', 'how to', 'what is'],
        requireCitations: true,
      },
    ],
    prohibitedTopics,
    refusalTemplates: [
      {
        id: 'out-of-scope',
        triggerCondition: 'Question outside training scope',
        message: "I'm sorry, but that question is outside the scope of this training module. Please ask questions related to the training content.",
        suggestAlternatives: true,
        alternatives: ['Review the training objectives', 'Ask about specific sections'],
      },
      {
        id: 'prohibited-topic',
        triggerCondition: 'Prohibited topic detected',
        message: "I'm not able to provide guidance on that topic. Please consult with your supervisor or the appropriate professional.",
        suggestAlternatives: false,
      },
    ],
    escalationTriggers: [
      {
        id: 'emergency',
        condition: 'Emergency situation mentioned',
        patterns: ['emergency', 'urgent', 'immediate danger', 'life-threatening'],
        action: 'redirect',
        userMessage: 'If this is an emergency, please contact emergency services immediately.',
      },
    ],
    scopeOfAdvice,
    responseDisclaimers: disclaimers.length > 0 ? disclaimers : [
      'This information is for training purposes only.',
      'Always follow your organization\'s specific policies and procedures.',
    ],
    maxResponseLength: 1000,
    requireCitations: true,
    citationFormat: 'inline',
    confidenceThreshold: 0.7,
    lowConfidenceResponse: "I'm not confident enough to answer that question based on the training materials. Please consult your supervisor or refer to the full training documentation.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Re-exports
export type { ChatConfig, ChatPolicy, ChatMessage, ChatRequest, ChatResponse };

// Vector stores
export type { VectorStore } from './index.js';
export { PgVectorStore, OpenAIEmbeddingProvider, createPgVectorStore } from './vector-stores/pgvector.js';
export type { PgVectorConfig, EmbeddingProvider } from './vector-stores/pgvector.js';
