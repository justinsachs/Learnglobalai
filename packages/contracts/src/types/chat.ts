/**
 * Chat and RAG system types
 * Module-scoped chat with policy guardrails
 */

import type { ModuleId, RunId, Timestamp } from './base.js';

/**
 * Topic allowlist entry
 */
export interface AllowedTopic {
  /** Topic identifier */
  id: string;
  /** Topic name */
  name: string;
  /** Description of what's allowed */
  description: string;
  /** Keywords that indicate this topic */
  keywords: string[];
  /** Whether citations are required for claims */
  requireCitations: boolean;
}

/**
 * Refusal template
 */
export interface RefusalTemplate {
  /** Template ID */
  id: string;
  /** When to use this template */
  triggerCondition: string;
  /** The refusal message */
  message: string;
  /** Whether to suggest alternatives */
  suggestAlternatives: boolean;
  /** Alternative suggestions */
  alternatives?: string[];
}

/**
 * Escalation trigger
 */
export interface EscalationTrigger {
  /** Trigger ID */
  id: string;
  /** Trigger condition description */
  condition: string;
  /** Keywords or patterns */
  patterns: string[];
  /** Escalation action */
  action: 'flag' | 'notify' | 'block' | 'redirect';
  /** Message to show user */
  userMessage?: string;
  /** Internal notification target */
  notifyTarget?: string;
}

/**
 * Chat policy configuration
 */
export interface ChatPolicy {
  /** Policy ID */
  id: string;

  /** Module ID this policy applies to */
  moduleId: ModuleId;

  /** Policy version */
  version: string;

  /** Policy name */
  name: string;

  /** Policy description */
  description: string;

  /** Allowed topics */
  allowedTopics: AllowedTopic[];

  /** Prohibited topics */
  prohibitedTopics: string[];

  /** Refusal templates */
  refusalTemplates: RefusalTemplate[];

  /** Escalation triggers */
  escalationTriggers: EscalationTrigger[];

  /** Scope of advice statement */
  scopeOfAdvice: string;

  /** Required disclaimers for responses */
  responseDisclaimers: string[];

  /** Maximum response length */
  maxResponseLength: number;

  /** Whether to require citations */
  requireCitations: boolean;

  /** Citation format */
  citationFormat: 'inline' | 'footnote' | 'endnote';

  /** Confidence threshold for answers */
  confidenceThreshold: number;

  /** Low confidence response */
  lowConfidenceResponse: string;

  /** Created timestamp */
  createdAt: Timestamp;

  /** Updated timestamp */
  updatedAt: Timestamp;
}

/**
 * Retrieval source configuration
 */
export interface RetrievalSource {
  /** Source ID */
  id: string;
  /** Source type */
  type: 'sourcepack' | 'artifact' | 'standard' | 'external';
  /** Source name */
  name: string;
  /** URI to the source */
  uri: string;
  /** Priority (higher = preferred) */
  priority: number;
  /** Whether this source is active */
  active: boolean;
}

/**
 * Chat configuration for a module
 */
export interface ChatConfig {
  /** Config ID */
  id: string;

  /** Module ID */
  moduleId: ModuleId;

  /** Run ID that created this config */
  runId: RunId;

  /** Policy ID */
  policyId: string;

  /** Retrieval index ID */
  retrievalIndexId: string;

  /** Retrieval sources */
  sources: RetrievalSource[];

  /** System prompt template */
  systemPromptTemplate: string;

  /** Model configuration */
  modelConfig: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };

  /** Feature flags */
  features: {
    streamingEnabled: boolean;
    historyEnabled: boolean;
    feedbackEnabled: boolean;
    suggestionsEnabled: boolean;
  };

  /** Created timestamp */
  createdAt: Timestamp;

  /** Updated timestamp */
  updatedAt: Timestamp;

  /** Active status */
  active: boolean;
}

/**
 * Retrieved context chunk
 */
export interface RetrievedChunk {
  /** Chunk ID */
  id: string;
  /** Source ID */
  sourceId: string;
  /** Source name */
  sourceName: string;
  /** Content text */
  content: string;
  /** Relevance score */
  score: number;
  /** Metadata */
  metadata: {
    section?: string;
    page?: number;
    heading?: string;
  };
}

/**
 * Chat message
 */
export interface ChatMessage {
  /** Message ID */
  id: string;

  /** Module ID */
  moduleId: ModuleId;

  /** Conversation ID */
  conversationId: string;

  /** Role */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Timestamp */
  timestamp: Timestamp;

  /** Retrieved context (for assistant messages) */
  retrievedContext?: RetrievedChunk[];

  /** Citations used (for assistant messages) */
  citations?: Array<{
    sourceId: string;
    sourceName: string;
    excerpt: string;
  }>;

  /** Policy violations detected */
  policyViolations?: Array<{
    type: string;
    description: string;
    action: string;
  }>;

  /** Token usage */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Feedback (if provided) */
  feedback?: {
    rating: 'positive' | 'negative';
    comment?: string;
    timestamp: Timestamp;
  };

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat conversation
 */
export interface ChatConversation {
  /** Conversation ID */
  id: string;

  /** Module ID */
  moduleId: ModuleId;

  /** User ID (if authenticated) */
  userId?: string;

  /** Session ID */
  sessionId: string;

  /** Messages */
  messages: ChatMessage[];

  /** Started timestamp */
  startedAt: Timestamp;

  /** Last activity timestamp */
  lastActivityAt: Timestamp;

  /** Status */
  status: 'active' | 'ended' | 'escalated';

  /** Escalation details (if escalated) */
  escalation?: {
    trigger: string;
    timestamp: Timestamp;
    handled: boolean;
    handledBy?: string;
  };

  /** Summary (generated) */
  summary?: string;

  /** Topics discussed */
  topicsDiscussed?: string[];
}

/**
 * Chat request
 */
export interface ChatRequest {
  /** Module ID */
  moduleId: ModuleId;
  /** Conversation ID (optional, creates new if not provided) */
  conversationId?: string;
  /** User message */
  message: string;
  /** Session ID */
  sessionId: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Whether to stream response */
  stream?: boolean;
}

/**
 * Chat response
 */
export interface ChatResponse {
  /** Message ID */
  messageId: string;
  /** Conversation ID */
  conversationId: string;
  /** Response content */
  content: string;
  /** Citations */
  citations: Array<{
    sourceId: string;
    sourceName: string;
    excerpt: string;
  }>;
  /** Suggested follow-ups */
  suggestions?: string[];
  /** Token usage */
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Response timestamp */
  timestamp: Timestamp;
}
