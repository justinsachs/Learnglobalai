/**
 * Base Agent Framework for LearnGlobal.ai
 *
 * Provides a foundation for specialized LLM agents that handle different
 * parts of the content generation pipeline.
 */

import type { LLMProvider, TokenUsage } from '../types.js';

/**
 * Agent execution context with shared state
 */
export interface AgentContext {
  runId: string;
  moduleId: string;
  vertical: string;
  traceEnabled: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage: TokenUsage;
  executionTimeMs: number;
  retryCount: number;
  trace?: AgentTrace[];
}

/**
 * Agent execution trace for debugging
 */
export interface AgentTrace {
  step: string;
  timestamp: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 120000,
  temperature: 0.7,
  maxTokens: 4096,
};

/**
 * Base agent class that all specialized agents extend
 */
export abstract class BaseAgent<TInput, TOutput> {
  protected llmProvider: LLMProvider;
  protected config: AgentConfig;
  protected traces: AgentTrace[] = [];

  constructor(llmProvider: LLMProvider, config: Partial<AgentConfig> = {}) {
    this.llmProvider = llmProvider;
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  /**
   * Execute the agent's task with retry logic
   */
  async execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;
    let totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    this.traces = [];

    while (retryCount <= this.config.maxRetries) {
      try {
        this.trace('execute_start', { input, retryCount });

        const result = await this.runWithTimeout(
          this.run(input, context),
          this.config.timeoutMs
        );

        totalUsage.prompt += result.usage.prompt;
        totalUsage.completion += result.usage.completion;
        totalUsage.total += result.usage.total;

        this.trace('execute_success', { output: result.data });

        return {
          success: true,
          data: result.data,
          usage: totalUsage,
          executionTimeMs: Date.now() - startTime,
          retryCount,
          trace: context.traceEnabled ? this.traces : undefined,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.trace('execute_error', { error: lastError });

        if (this.isRetryableError(error)) {
          retryCount++;
          if (retryCount <= this.config.maxRetries) {
            await this.delay(this.config.retryDelayMs * retryCount);
          }
        } else {
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError,
      usage: totalUsage,
      executionTimeMs: Date.now() - startTime,
      retryCount,
      trace: context.traceEnabled ? this.traces : undefined,
    };
  }

  /**
   * Abstract method that subclasses implement for their specific task
   */
  protected abstract run(
    input: TInput,
    context: AgentContext
  ): Promise<{ data: TOutput; usage: TokenUsage }>;

  /**
   * Get the agent's name for logging/tracing
   */
  abstract get name(): string;

  /**
   * Get the agent's description
   */
  abstract get description(): string;

  /**
   * Add a trace entry
   */
  protected trace(step: string, details: { input?: unknown; output?: unknown; error?: string }): void {
    const now = Date.now();
    const lastTrace = this.traces[this.traces.length - 1];
    const durationMs = lastTrace
      ? now - new Date(lastTrace.timestamp).getTime()
      : 0;

    this.traces.push({
      step,
      timestamp: new Date().toISOString(),
      ...details,
      durationMs,
    });
  }

  /**
   * Check if an error is retryable
   */
  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('503') ||
        message.includes('429')
      );
    }
    return false;
  }

  /**
   * Run a promise with a timeout
   */
  protected async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Agent execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Delay helper for retries
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Agent registry for managing available agents
 */
export class AgentRegistry {
  private agents = new Map<string, BaseAgent<unknown, unknown>>();

  register<TInput, TOutput>(agent: BaseAgent<TInput, TOutput>): void {
    this.agents.set(agent.name, agent as BaseAgent<unknown, unknown>);
  }

  get<TInput, TOutput>(name: string): BaseAgent<TInput, TOutput> | undefined {
    return this.agents.get(name) as BaseAgent<TInput, TOutput> | undefined;
  }

  list(): Array<{ name: string; description: string }> {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
    }));
  }
}

/**
 * Global agent registry instance
 */
export const agentRegistry = new AgentRegistry();
