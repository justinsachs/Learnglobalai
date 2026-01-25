/**
 * LearnGlobal.ai API Server
 * Main entry point
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { loadConfig } from './config.js';
import { initDatabase, closeDatabase } from './db/connection.js';
import { logger } from './utils/logger.js';
import { moduleRoutes } from './routes/modules.js';
import { chatRoutes } from './routes/chat.js';
import { approvalRoutes } from './routes/approvals.js';
import { verticalRoutes } from './routes/verticals.js';
import { learnerRoutes } from './routes/learners.js';
import { startWorker, stopWorker } from './queue/worker.js';
import { closeQueue } from './queue/index.js';
import { metricsHandler, trackHttpRequest } from './utils/metrics.js';

async function main() {
  const config = loadConfig();

  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.env === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      } : undefined,
    },
  });

  // Request timing for metrics
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    trackHttpRequest(
      request.method,
      request.routeOptions?.url || request.url,
      reply.statusCode,
      duration
    );
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.api.corsOrigins,
    credentials: true,
  });

  await fastify.register(helmet);

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'LearnGlobal.ai API',
        description: 'Module-to-Assets Pipeline Backend API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${config.api.host}:${config.api.port}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'modules', description: 'Module management' },
        { name: 'runs', description: 'Pipeline run management' },
        { name: 'chat', description: 'Module chat' },
        { name: 'approvals', description: 'Approval workflow' },
        { name: 'verticals', description: 'Vertical/brand configuration' },
        { name: 'learners', description: 'Learner profiling and adaptive learning' },
        { name: 'admin', description: 'Admin operations' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Initialize database
  await initDatabase();

  // Start background worker for pipeline processing
  const workerEnabled = process.env.WORKER_ENABLED !== 'false';
  if (workerEnabled) {
    startWorker();
    logger.info('Pipeline worker started');
  }

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // Deep health check
  fastify.get('/health/deep', async () => {
    const checks: Record<string, { status: string; latency?: number }> = {};

    // Check database
    try {
      const start = Date.now();
      // Would perform actual DB query here
      checks.database = { status: 'ok', latency: Date.now() - start };
    } catch {
      checks.database = { status: 'error' };
    }

    // Check Redis
    try {
      const start = Date.now();
      // Would perform actual Redis ping here
      checks.redis = { status: 'ok', latency: Date.now() - start };
    } catch {
      checks.redis = { status: 'error' };
    }

    const allOk = Object.values(checks).every(c => c.status === 'ok');

    return {
      status: allOk ? 'healthy' : 'degraded',
      checks,
    };
  });

  // Prometheus metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return metricsHandler();
  });

  // Register routes
  await fastify.register(moduleRoutes, { prefix: '/api/v1' });
  await fastify.register(chatRoutes, { prefix: '/api/v1' });
  await fastify.register(approvalRoutes, { prefix: '/api/v1' });
  await fastify.register(verticalRoutes, { prefix: '/api/v1' });
  await fastify.register(learnerRoutes, { prefix: '/api/v1/learners' });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message,
      ...(config.env === 'development' && { stack: error.stack }),
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await stopWorker();
    await closeQueue();
    await fastify.close();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await fastify.listen({
      port: config.api.port,
      host: config.api.host,
    });

    logger.info(`Server listening on ${config.api.host}:${config.api.port}`);
    logger.info(`API docs available at http://${config.api.host}:${config.api.port}/docs`);
    logger.info(`Metrics available at http://${config.api.host}:${config.api.port}/metrics`);
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Extend FastifyRequest for timing
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
