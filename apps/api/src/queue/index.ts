/**
 * BullMQ Job Queue
 * Handles background pipeline execution
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';

// Job types
export const QUEUE_NAME = 'learnglobal-pipeline';

export interface PipelineJobData {
  type: 'start' | 'resume' | 'rerun';
  runId: string;
  moduleId: string;
  specId: number;
  triggeredBy: string;
  config?: Record<string, unknown>;
  fromState?: string;
}

let queue: Queue<PipelineJobData> | null = null;
let redis: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redis) {
    const config = loadConfig();
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export function getQueue(): Queue<PipelineJobData> {
  if (!queue) {
    const connection = getRedisConnection();
    queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return queue;
}

/**
 * Add a pipeline job to the queue
 */
export async function addPipelineJob(data: PipelineJobData): Promise<Job<PipelineJobData>> {
  const q = getQueue();

  const job = await q.add(`pipeline-${data.type}`, data, {
    jobId: `${data.type}-${data.runId}`,
    priority: data.type === 'start' ? 1 : 2,
  });

  logger.info('Pipeline job added to queue', {
    jobId: job.id,
    type: data.type,
    runId: data.runId,
  });

  return job;
}

/**
 * Close queue and redis connections
 */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Export for worker creation
export { Queue, Worker, Job };
