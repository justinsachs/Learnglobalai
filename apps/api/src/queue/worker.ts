/**
 * Pipeline Worker
 * Processes pipeline jobs from the queue
 */

import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { PipelineState } from '@learnglobal/contracts';
import { createOrchestrator, createRunContext, type OrchestratorDependencies, type RunContext } from '@learnglobal/orchestrator';
import { createLLMProvider } from '@learnglobal/llm';
import {
  createS3ContentRepo,
  createNotebookLmConnector,
  createHeyGenConnector,
  createLmsConnector,
} from '@learnglobal/connectors';
import { getRedisConnection, QUEUE_NAME, type PipelineJobData } from './index.js';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Compute SHA-256 hash of content
 */
function computeContentHash(data: unknown): string {
  const json = JSON.stringify(data);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Generate storage path for an artifact
 */
function generateStoragePath(runId: string, artifactType: string, artifactId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `artifacts/${year}/${month}/${runId}/${artifactType}/${artifactId}.json`;
}

/**
 * Track state transition timing
 */
const stateTransitionTimestamps = new Map<string, number>();

function recordStateStart(runId: string, state: string): void {
  stateTransitionTimestamps.set(`${runId}:${state}`, Date.now());
}

function getStateDuration(runId: string, state: string): number {
  const startTime = stateTransitionTimestamps.get(`${runId}:${state}`);
  if (startTime) {
    const duration = Date.now() - startTime;
    stateTransitionTimestamps.delete(`${runId}:${state}`);
    return duration;
  }
  return 0;
}

let worker: Worker<PipelineJobData> | null = null;

/**
 * Create orchestrator dependencies with database integration
 */
function createDependencies(): OrchestratorDependencies {
  const config = loadConfig();
  const db = getDatabase();

  // Create LLM provider
  const llmProvider = createLLMProvider({
    provider: 'openai',
    apiKey: config.openai.apiKey,
    model: config.openai.model,
    maxRetries: config.openai.maxRetries,
  });

  // Create connectors
  const contentRepo = createS3ContentRepo({
    endpoint: config.storage.endpoint,
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
    bucket: config.storage.bucket,
    region: config.storage.region,
    forcePathStyle: true,
  });

  const notebookLm = createNotebookLmConnector({
    apiKey: config.notebooklm?.apiKey || 'mock',
    baseUrl: config.notebooklm?.baseUrl,
  });

  const heygen = createHeyGenConnector({
    apiKey: config.heygen?.apiKey || 'mock',
    baseUrl: config.heygen?.baseUrl,
  });

  const lms = createLmsConnector({
    provider: config.lms?.provider || 'filesystem',
    outputDir: config.lms?.outputDir || './output/lms',
  });

  return {
    llmProvider,
    contentRepo,
    notebookLm,
    heygen,
    lms,
    logger,

    async saveArtifact(runId: string, type: string, data: unknown): Promise<string> {
      const run = await db.query.runs.findFirst({
        where: eq(schema.runs.runId, runId),
      });
      if (!run) throw new Error(`Run not found: ${runId}`);

      const artifactId = `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const contentHash = computeContentHash(data);
      const storagePath = generateStoragePath(runId, type, artifactId);

      await db.insert(schema.artifacts).values({
        artifactId,
        runId: run.id,
        artifactType: type as any,
        data: data as any,
        contentHash,
        storagePath,
      });
      return artifactId;
    },

    async loadArtifact(uri: string): Promise<unknown> {
      // URI format: artifact://<artifactId>
      const artifactId = uri.replace('artifact://', '');
      const artifact = await db.query.artifacts.findFirst({
        where: eq(schema.artifacts.artifactId, artifactId),
      });
      return artifact?.data;
    },

    async getVerticalConfig(vertical: string) {
      // Try to load from database first
      const verticalConfig = await db.query.verticalConfigs.findFirst({
        where: eq(schema.verticalConfigs.verticalId, vertical),
      });

      if (verticalConfig?.config) {
        const cfg = verticalConfig.config as any;
        return {
          vertical,
          templates: cfg.templates || {
            outline: '',
            sourcepack: '',
            qa: '',
            mediaPromptPack: '',
            heygenScript: '',
          },
          qualityGates: cfg.qualityGates || {
            minTotalWords: 10000,
            minWordsPerHeading: 500,
            maxBulletRatio: 0.08,
            requireDisclaimers: true,
          },
          disclaimers: cfg.disclaimers || [],
          mediaConfig: cfg.mediaConfig || {
            videoMinutes: 10,
          },
          chatPolicy: cfg.chatPolicy || {
            allowedTopics: [],
            prohibitedTopics: [],
            disclaimers: [],
          },
        };
      }

      // Return defaults if not found
      return {
        vertical,
        templates: {
          outline: '',
          sourcepack: '',
          qa: '',
          mediaPromptPack: '',
          heygenScript: '',
        },
        qualityGates: {
          minTotalWords: 10000,
          minWordsPerHeading: 500,
          maxBulletRatio: 0.08,
          requireDisclaimers: true,
        },
        disclaimers: [
          'This training is for educational purposes only.',
          'Always follow your organization\'s specific policies and procedures.',
        ],
        mediaConfig: {
          videoMinutes: 10,
        },
        chatPolicy: {
          allowedTopics: ['training', 'procedures', 'safety'],
          prohibitedTopics: ['legal advice', 'medical diagnosis'],
          disclaimers: ['This is AI-generated guidance, not professional advice.'],
        },
      };
    },

    async saveRunState(context: RunContext): Promise<void> {
      const run = await db.query.runs.findFirst({
        where: eq(schema.runs.runId, context.runId),
      });

      if (!run) {
        throw new Error(`Run not found: ${context.runId}`);
      }

      // Record start time for the new state
      if (context.currentState) {
        recordStateStart(context.runId, context.currentState);
      }

      // Calculate duration for the previous state
      const durationMs = context.previousState
        ? getStateDuration(context.runId, context.previousState)
        : 0;

      // Update run record
      await db.update(schema.runs)
        .set({
          currentState: context.currentState,
          previousState: context.previousState,
          completedAt: context.completedAt ? new Date(context.completedAt) : null,
          error: context.error,
          updatedAt: new Date(),
        })
        .where(eq(schema.runs.id, run.id));

      // Insert state transition record
      await db.insert(schema.runStates).values({
        runId: run.id,
        fromState: context.previousState,
        toState: context.currentState,
        actor: 'orchestrator',
        durationMs,
        artifacts: context.checkpoint?.artifactHashes,
      });

      // Save artifacts to database
      if (context.outline) {
        await saveArtifact(db, run.id, 'outline', context.outline);
      }
      if (context.sourcePack) {
        await saveArtifact(db, run.id, 'sourcepack', context.sourcePack);
      }
      if (context.qaReport) {
        await saveArtifact(db, run.id, 'qa_report', context.qaReport);
      }
      if (context.mediaPromptPack) {
        await saveArtifact(db, run.id, 'media_prompt_pack', context.mediaPromptPack);
      }
      if (context.heygenPackage) {
        await saveArtifact(db, run.id, 'heygen_package', context.heygenPackage);
      }
      if (context.assetManifest) {
        await saveArtifact(db, run.id, 'asset_manifest', context.assetManifest);
      }
    },

    async loadRunState(runId: string): Promise<RunContext | null> {
      const run = await db.query.runs.findFirst({
        where: eq(schema.runs.runId, runId),
        with: {
          moduleSpec: true,
          artifacts: true,
        },
      });

      if (!run) {
        return null;
      }

      // Load artifacts from database
      const artifacts = run.artifacts.reduce((acc, artifact) => {
        acc[artifact.artifactType] = artifact.data;
        return acc;
      }, {} as Record<string, unknown>);

      return {
        runId: run.runId,
        moduleId: run.moduleId?.toString() || '',
        version: run.version,
        currentState: run.currentState as PipelineState,
        previousState: run.previousState as PipelineState | undefined,
        startedAt: run.startedAt?.toISOString() || new Date().toISOString(),
        completedAt: run.completedAt?.toISOString(),
        triggeredBy: run.triggeredBy || 'system',
        config: run.config as Record<string, unknown> || {},
        moduleSpec: run.moduleSpec?.specData as any,
        outline: artifacts.outline as any,
        sourcePack: artifacts.sourcepack as any,
        qaReport: artifacts.qa_report as any,
        mediaPromptPack: artifacts.media_prompt_pack as any,
        heygenPackage: artifacts.heygen_package as any,
        assetManifest: artifacts.asset_manifest as any,
        error: run.error as any,
        metadata: {},
      };
    },

    async logAuditEvent(event): Promise<void> {
      const run = await db.query.runs.findFirst({
        where: eq(schema.runs.runId, event.runId),
      });

      if (!run) {
        logger.warn('Cannot log audit event: run not found', { runId: event.runId });
        return;
      }

      const module = await db.query.modules.findFirst({
        where: eq(schema.modules.id, run.moduleId!),
      });

      await db.insert(schema.auditEvents).values({
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        runId: run.id,
        moduleId: module?.id,
        eventType: event.eventType as any,
        actor: event.actor,
        fromState: event.fromState,
        toState: event.toState,
        details: event.details,
      });
    },

    async getAuditEntries(runId: string) {
      const run = await db.query.runs.findFirst({
        where: eq(schema.runs.runId, runId),
      });

      if (!run) {
        return [];
      }

      const events = await db.query.auditEvents.findMany({
        where: eq(schema.auditEvents.runId, run.id),
        orderBy: (auditEvents, { asc }) => [asc(auditEvents.timestamp)],
      });

      return events.map(e => ({
        eventType: e.eventType,
        actor: e.actor || 'system',
        fromState: e.fromState || undefined,
        toState: e.toState || undefined,
        timestamp: e.timestamp?.toISOString() || new Date().toISOString(),
        details: e.details as Record<string, unknown> | undefined,
      }));
    },
  };
}

async function saveArtifact(
  db: ReturnType<typeof getDatabase>,
  runId: number,
  artifactType: string,
  data: unknown
): Promise<void> {
  // Get the run to retrieve the runId string
  const run = await db.query.runs.findFirst({
    where: eq(schema.runs.id, runId),
  });

  const runIdStr = run?.runId || `run-${runId}`;

  // Compute content hash
  const contentHash = computeContentHash(data);

  // Generate artifact ID
  const artifactId = `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Generate storage path
  const storagePath = generateStoragePath(runIdStr, artifactType, artifactId);

  // Check if artifact of this type already exists for this run
  const existing = await db.select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.runId, runId))
    .execute();

  const existingArtifact = existing.find(a => a.artifactType === artifactType);

  if (existingArtifact) {
    // Update existing artifact
    await db.update(schema.artifacts)
      .set({
        data: data as any,
        contentHash,
        storagePath,
        updatedAt: new Date(),
      })
      .where(eq(schema.artifacts.id, existingArtifact.id));
  } else {
    // Insert new artifact
    await db.insert(schema.artifacts).values({
      artifactId,
      runId,
      artifactType: artifactType as any,
      data: data as any,
      contentHash,
      storagePath,
    });
  }
}

/**
 * Process a pipeline job
 */
async function processJob(job: Job<PipelineJobData>): Promise<void> {
  const { type, runId, moduleId, specId, triggeredBy, config, fromState } = job.data;

  logger.info('Processing pipeline job', {
    jobId: job.id,
    type,
    runId,
    moduleId,
  });

  const db = getDatabase();
  const dependencies = createDependencies();
  const orchestrator = createOrchestrator(dependencies);

  try {
    let result: RunContext;

    switch (type) {
      case 'start': {
        // Load the module spec
        const spec = await db.query.moduleSpecs.findFirst({
          where: eq(schema.moduleSpecs.id, specId),
        });

        if (!spec) {
          throw new Error(`Module spec not found: ${specId}`);
        }

        // Create run context
        const context = createRunContext(
          {
            ...spec.specData as any,
            moduleId,
            version: spec.version,
          },
          triggeredBy,
          config
        );

        // Override runId to match what was created in the API
        context.runId = runId;

        // Run the pipeline
        result = await orchestrator.run(context);
        break;
      }

      case 'resume': {
        result = await orchestrator.resume(runId, fromState as PipelineState | undefined);
        break;
      }

      case 'rerun': {
        if (!fromState) {
          throw new Error('fromState is required for rerun jobs');
        }
        result = await orchestrator.rerunFromState(runId, fromState as PipelineState);
        break;
      }

      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    logger.info('Pipeline job completed', {
      jobId: job.id,
      runId: result.runId,
      finalState: result.currentState,
    });
  } catch (error) {
    logger.error('Pipeline job failed', {
      jobId: job.id,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Start the worker
 */
export function startWorker(): Worker<PipelineJobData> {
  if (worker) {
    return worker;
  }

  const connection = getRedisConnection();

  worker = new Worker<PipelineJobData>(
    QUEUE_NAME,
    processJob,
    {
      connection,
      concurrency: 2, // Process 2 jobs at a time
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs per minute
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, runId: job.data.runId });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', {
      jobId: job?.id,
      runId: job?.data.runId,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('Worker error', { error: error.message });
  });

  logger.info('Pipeline worker started');

  return worker;
}

/**
 * Stop the worker
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Pipeline worker stopped');
  }
}
