/**
 * Connector Types
 */

/**
 * Connector authentication scope
 */
export interface ConnectorScope {
  name: string;
  description: string;
  permissions: string[];
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Redaction rule for logging
 */
export interface RedactionRule {
  fieldPath: string;
  method: 'mask' | 'hash' | 'remove';
  pattern?: string;
}

/**
 * Base connector configuration
 */
export interface BaseConnectorConfig {
  name: string;
  enabled: boolean;
  retryConfig: RetryConfig;
  timeoutMs: number;
  redactionRules: RedactionRule[];
}

/**
 * Connector error
 */
export interface ConnectorError extends Error {
  code: string;
  connector: string;
  operation: string;
  retryable: boolean;
  retryAfterMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Create a connector error
 */
export function createConnectorError(
  connector: string,
  operation: string,
  code: string,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
): ConnectorError {
  const error = new Error(message) as ConnectorError;
  error.code = code;
  error.connector = connector;
  error.operation = operation;
  error.retryable = retryable;
  error.details = details;
  return error;
}

/**
 * Logger interface for connectors
 */
export interface ConnectorLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', '429', '500', '502', '503', '504'],
};

/**
 * Execute with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  logger?: ConnectorLogger,
  operationName?: string
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorCode = (error as any).code || (error as any).status?.toString() || '';

      const isRetryable = config.retryableErrors.some(
        (code) => errorCode.includes(code) || lastError?.message?.includes(code)
      );

      if (!isRetryable || attempt === config.maxRetries) {
        throw error;
      }

      logger?.warn(`Retrying ${operationName || 'operation'}`, {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delay,
        error: lastError.message,
      });

      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
