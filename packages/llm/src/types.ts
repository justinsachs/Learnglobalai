/**
 * LLM Provider Types
 */

import type {
  ModuleSpec,
  Outline,
  SourcePack,
  QAReport,
  MediaPromptPack,
  HeyGenPackage,
} from '@learnglobal/contracts';

/**
 * Token usage tracking
 */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * LLM generation result
 */
export interface GenerationResult<T> {
  data: T;
  usage: TokenUsage;
  model: string;
  finishReason: string;
}

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: 'openai';
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  organizationId?: string;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  /**
   * Generate an outline from a module spec
   */
  generateOutline(
    spec: ModuleSpec,
    template: string
  ): Promise<{ outline: Outline; usage: TokenUsage }>;

  /**
   * Generate a full SourcePack from outline and spec
   */
  generateSourcePack(
    spec: ModuleSpec,
    outline: Outline,
    template: string
  ): Promise<{ sourcePack: SourcePack; usage: TokenUsage }>;

  /**
   * Generate a QA report (validation logic, not LLM-based)
   */
  generateQAReport(
    spec: ModuleSpec,
    sourcePack: SourcePack
  ): Promise<{ qaReport: QAReport; usage: TokenUsage }>;

  /**
   * Generate media prompt pack
   */
  generateMediaPromptPack(
    spec: ModuleSpec,
    sourcePack: SourcePack,
    template: string
  ): Promise<{ mediaPromptPack: MediaPromptPack; usage: TokenUsage }>;

  /**
   * Generate HeyGen package
   */
  generateHeyGenPackage(
    spec: ModuleSpec,
    mediaPromptPack: MediaPromptPack,
    template: string
  ): Promise<{ heygenPackage: HeyGenPackage; usage: TokenUsage }>;

  /**
   * Generic completion for chat
   */
  complete(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    }
  ): Promise<{ content: string; usage: TokenUsage }>;
}

/**
 * Prompt template with placeholders
 */
export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat: 'json' | 'markdown' | 'text';
  expectedSchema?: string;
}
