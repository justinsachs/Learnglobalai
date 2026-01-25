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
import { startWorker, stopWorker } from './queue/worker.js';
import { closeQueue } from './queue/index.js';

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
      ],
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

  // Register routes
  await fastify.register(moduleRoutes, { prefix: '/api/v1' });
  await fastify.register(chatRoutes, { prefix: '/api/v1' });

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
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
