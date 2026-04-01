/**
 * Prometheus Metrics and Observability
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry
export const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// Custom metrics

/**
 * HTTP Request metrics
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * Pipeline metrics
 */
export const pipelineRunsTotal = new Counter({
  name: 'pipeline_runs_total',
  help: 'Total number of pipeline runs',
  labelNames: ['vertical', 'status'],
  registers: [register],
});

export const pipelineRunsActive = new Gauge({
  name: 'pipeline_runs_active',
  help: 'Number of currently active pipeline runs',
  labelNames: ['vertical'],
  registers: [register],
});

export const pipelineStateDuration = new Histogram({
  name: 'pipeline_state_duration_seconds',
  help: 'Duration spent in each pipeline state',
  labelNames: ['state', 'vertical'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const pipelineStateTransitions = new Counter({
  name: 'pipeline_state_transitions_total',
  help: 'Total number of state transitions',
  labelNames: ['from_state', 'to_state', 'vertical'],
  registers: [register],
});

/**
 * LLM metrics
 */
export const llmRequestsTotal = new Counter({
  name: 'llm_requests_total',
  help: 'Total number of LLM API requests',
  labelNames: ['provider', 'model', 'operation', 'status'],
  registers: [register],
});

export const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_seconds',
  help: 'LLM API request duration in seconds',
  labelNames: ['provider', 'model', 'operation'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register],
});

export const llmTokensUsed = new Counter({
  name: 'llm_tokens_total',
  help: 'Total tokens used in LLM requests',
  labelNames: ['provider', 'model', 'type'],
  registers: [register],
});

/**
 * Connector metrics
 */
export const connectorRequestsTotal = new Counter({
  name: 'connector_requests_total',
  help: 'Total number of connector API requests',
  labelNames: ['connector', 'operation', 'status'],
  registers: [register],
});

export const connectorRequestDuration = new Histogram({
  name: 'connector_request_duration_seconds',
  help: 'Connector API request duration in seconds',
  labelNames: ['connector', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * Job queue metrics
 */
export const jobQueueDepth = new Gauge({
  name: 'job_queue_depth',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [register],
});

/**
 * Chat metrics
 */
export const chatMessagesTotal = new Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages',
  labelNames: ['module_id', 'role'],
  registers: [register],
});

export const chatResponseDuration = new Histogram({
  name: 'chat_response_duration_seconds',
  help: 'Chat response generation duration in seconds',
  labelNames: ['module_id'],
  buckets: [0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * Database metrics
 */
export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

/**
 * Helper functions for tracking metrics
 */

export function trackHttpRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  httpRequestsTotal.labels(method, path, status.toString()).inc();
  httpRequestDuration.labels(method, path, status.toString()).observe(durationMs / 1000);
}

export function trackPipelineRun(
  vertical: string,
  status: 'started' | 'completed' | 'failed'
): void {
  pipelineRunsTotal.labels(vertical, status).inc();

  if (status === 'started') {
    pipelineRunsActive.labels(vertical).inc();
  } else {
    pipelineRunsActive.labels(vertical).dec();
  }
}

export function trackStateTransition(
  fromState: string,
  toState: string,
  vertical: string,
  durationMs: number
): void {
  pipelineStateTransitions.labels(fromState, toState, vertical).inc();
  pipelineStateDuration.labels(toState, vertical).observe(durationMs / 1000);
}

export function trackLlmRequest(
  provider: string,
  model: string,
  operation: string,
  status: 'success' | 'error',
  durationMs: number,
  tokenUsage?: { prompt: number; completion: number }
): void {
  llmRequestsTotal.labels(provider, model, operation, status).inc();
  llmRequestDuration.labels(provider, model, operation).observe(durationMs / 1000);

  if (tokenUsage) {
    llmTokensUsed.labels(provider, model, 'prompt').inc(tokenUsage.prompt);
    llmTokensUsed.labels(provider, model, 'completion').inc(tokenUsage.completion);
  }
}

export function trackConnectorRequest(
  connector: string,
  operation: string,
  status: 'success' | 'error',
  durationMs: number
): void {
  connectorRequestsTotal.labels(connector, operation, status).inc();
  connectorRequestDuration.labels(connector, operation).observe(durationMs / 1000);
}

/**
 * Metrics endpoint handler for Fastify
 */
export async function metricsHandler(): Promise<string> {
  return register.metrics();
}
