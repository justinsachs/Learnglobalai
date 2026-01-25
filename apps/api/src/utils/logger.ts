/**
 * Structured Logger
 * Uses Pino for high-performance structured logging
 */

import pino from 'pino';
import { getConfig } from '../config.js';

// Determine if we should use pretty printing
const isDev = process.env.NODE_ENV === 'development';

// Create base logger configuration
function createLogger(): pino.Logger {
  const config = getConfig();

  const baseConfig: pino.LoggerOptions = {
    level: config.logLevel,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: config.observability.otelServiceName,
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.secret',
        '*.apiKey',
        '*.accessKey',
        '*.secretKey',
        '*.token',
        '*.jwt',
      ],
      censor: '[REDACTED]',
    },
  };

  if (isDev) {
    // Use pino-pretty for development
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  // Production: JSON output
  return pino(baseConfig);
}

export const logger = createLogger();

/**
 * Create a child logger with additional context
 */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(
  requestId: string,
  moduleId?: string,
  runId?: string
): pino.Logger {
  return logger.child({
    requestId,
    ...(moduleId && { moduleId }),
    ...(runId && { runId }),
  });
}

/**
 * Create a run-scoped logger for orchestrator operations
 */
export function createRunLogger(runId: string, moduleId: string): pino.Logger {
  return logger.child({
    runId,
    moduleId,
    component: 'orchestrator',
  });
}

/**
 * Create a connector-scoped logger
 */
export function createConnectorLogger(
  connectorName: string,
  runId?: string
): pino.Logger {
  return logger.child({
    connector: connectorName,
    component: 'connector',
    ...(runId && { runId }),
  });
}

/**
 * Log an audit event
 */
export function logAuditEvent(
  eventType: string,
  actor: string,
  details: Record<string, unknown>,
  runId?: string,
  moduleId?: string
): void {
  logger.info(
    {
      audit: true,
      eventType,
      actor,
      details,
      ...(runId && { runId }),
      ...(moduleId && { moduleId }),
    },
    `Audit: ${eventType}`
  );
}

/**
 * Log LLM API call
 */
export function logLLMCall(
  operation: string,
  model: string,
  promptHash: string,
  tokenUsage: { prompt: number; completion: number; total: number },
  durationMs: number,
  runId?: string
): void {
  logger.info(
    {
      llm: true,
      operation,
      model,
      promptHash,
      tokenUsage,
      durationMs,
      ...(runId && { runId }),
    },
    `LLM call: ${operation}`
  );
}

/**
 * Log connector operation
 */
export function logConnectorOperation(
  connector: string,
  operation: string,
  success: boolean,
  durationMs: number,
  details?: Record<string, unknown>,
  runId?: string
): void {
  const logFn = success ? logger.info.bind(logger) : logger.error.bind(logger);
  logFn(
    {
      connector,
      operation,
      success,
      durationMs,
      ...details,
      ...(runId && { runId }),
    },
    `Connector ${connector}: ${operation} ${success ? 'succeeded' : 'failed'}`
  );
}

/**
 * Log state transition
 */
export function logStateTransition(
  runId: string,
  fromState: string | null,
  toState: string,
  durationMs?: number
): void {
  logger.info(
    {
      stateTransition: true,
      runId,
      fromState,
      toState,
      durationMs,
    },
    `State transition: ${fromState ?? 'INIT'} -> ${toState}`
  );
}

export default logger;
