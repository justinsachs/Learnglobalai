/**
 * Module API Routes
 * Handles module CRUD and pipeline run management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import { ModuleSpecSchema } from '@learnglobal/contracts';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { sha256 } from '../utils/hash.js';

interface CreateModuleBody {
  title: string;
  description: string;
  vertical: string;
  author: string;
  spec: unknown;
}

interface StartRunBody {
  triggeredBy: string;
  config?: {
    skipNotebookLm?: boolean;
    skipHeygen?: boolean;
    skipLmsPublish?: boolean;
    skipChat?: boolean;
    autoApprove?: boolean;
  };
}

export async function moduleRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();

  /**
   * List all modules
   */
  fastify.get('/modules', async (request: FastifyRequest, reply: FastifyReply) => {
    const modules = await db.query.modules.findMany({
      where: eq(schema.modules.deletedAt, null as any),
      orderBy: desc(schema.modules.createdAt),
    });

    return reply.send({
      success: true,
      data: modules,
    });
  });

  /**
   * Get a single module by ID
   */
  fastify.get('/modules/:moduleId', async (request: FastifyRequest<{ Params: { moduleId: string } }>, reply: FastifyReply) => {
    const { moduleId } = request.params;

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
      with: {
        specs: {
          orderBy: desc(schema.moduleSpecs.createdAt),
          limit: 1,
        },
        runs: {
          orderBy: desc(schema.runs.startedAt),
          limit: 10,
        },
      },
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    return reply.send({
      success: true,
      data: module,
    });
  });

  /**
   * Create a new module with spec
   */
  fastify.post('/modules', async (request: FastifyRequest<{ Body: CreateModuleBody }>, reply: FastifyReply) => {
    const { title, description, vertical, author, spec } = request.body;

    // Validate spec
    const validation = ModuleSpecSchema.safeParse(spec);
    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid module specification',
        details: validation.error.errors,
      });
    }

    const moduleId = `mod-${nanoid(10)}`;
    const specHash = sha256(JSON.stringify(spec));

    try {
      // Create module
      const [module] = await db.insert(schema.modules).values({
        moduleId,
        title,
        description,
        vertical,
        author,
        status: 'draft',
      }).returning();

      // Create spec version
      const [moduleSpec] = await db.insert(schema.moduleSpecs).values({
        moduleId: module.id,
        version: '1.0.0',
        specData: spec,
        specHash,
        isActive: true,
        createdBy: author,
      }).returning();

      logger.info('Module created', { moduleId, specId: moduleSpec.id });

      return reply.status(201).send({
        success: true,
        data: {
          id: module.id,
          moduleId: module.moduleId,
          specId: moduleSpec.id,
          version: moduleSpec.version,
        },
      });
    } catch (error) {
      logger.error('Failed to create module', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to create module',
      });
    }
  });

  /**
   * Update module spec (creates new version)
   */
  fastify.put('/modules/:moduleId/spec', async (request: FastifyRequest<{ Params: { moduleId: string }; Body: { spec: unknown; author: string } }>, reply: FastifyReply) => {
    const { moduleId } = request.params;
    const { spec, author } = request.body;

    // Validate spec
    const validation = ModuleSpecSchema.safeParse(spec);
    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid module specification',
        details: validation.error.errors,
      });
    }

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    // Get current version
    const currentSpec = await db.query.moduleSpecs.findFirst({
      where: eq(schema.moduleSpecs.moduleId, module.id),
      orderBy: desc(schema.moduleSpecs.createdAt),
    });

    const currentVersion = currentSpec?.version || '1.0.0';
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    const newVersion = `${major}.${minor}.${patch + 1}`;
    const specHash = sha256(JSON.stringify(spec));

    // Deactivate old specs
    await db.update(schema.moduleSpecs)
      .set({ isActive: false })
      .where(eq(schema.moduleSpecs.moduleId, module.id));

    // Create new spec version
    const [newSpec] = await db.insert(schema.moduleSpecs).values({
      moduleId: module.id,
      version: newVersion,
      specData: spec,
      specHash,
      isActive: true,
      createdBy: author,
    }).returning();

    // Update module version
    await db.update(schema.modules)
      .set({ currentVersion: newVersion, updatedAt: new Date() })
      .where(eq(schema.modules.id, module.id));

    return reply.send({
      success: true,
      data: {
        specId: newSpec.id,
        version: newVersion,
      },
    });
  });

  /**
   * Start a pipeline run for a module
   */
  fastify.post('/modules/:moduleId/runs', async (request: FastifyRequest<{ Params: { moduleId: string }; Body: StartRunBody }>, reply: FastifyReply) => {
    const { moduleId } = request.params;
    const { triggeredBy, config = {} } = request.body;

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
      with: {
        specs: {
          where: eq(schema.moduleSpecs.isActive, true),
          limit: 1,
        },
      },
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    const activeSpec = module.specs[0];
    if (!activeSpec) {
      return reply.status(400).send({
        success: false,
        error: 'No active spec found for module',
      });
    }

    const runId = `run-${nanoid(10)}`;

    // Create run
    const [run] = await db.insert(schema.runs).values({
      runId,
      moduleId: module.id,
      moduleSpecId: activeSpec.id,
      version: activeSpec.version,
      currentState: 'DRAFT_MODULE_SPEC',
      triggeredBy,
      config,
    }).returning();

    // Create initial state record
    await db.insert(schema.runStates).values({
      runId: run.id,
      toState: 'DRAFT_MODULE_SPEC',
      actor: triggeredBy,
    });

    // Create audit event
    await db.insert(schema.auditEvents).values({
      eventId: `evt-${nanoid(10)}`,
      runId: run.id,
      moduleId: module.id,
      eventType: 'run_created',
      actor: triggeredBy,
      details: { config },
    });

    logger.info('Pipeline run started', { runId, moduleId });

    // TODO: Trigger actual pipeline execution via job queue

    return reply.status(201).send({
      success: true,
      data: {
        runId: run.runId,
        state: run.currentState,
        startedAt: run.startedAt,
      },
    });
  });

  /**
   * Get run status
   */
  fastify.get('/runs/:runId', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.runId, runId),
      with: {
        states: {
          orderBy: desc(schema.runStates.transitionedAt),
        },
        artifacts: true,
      },
    });

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: 'Run not found',
      });
    }

    return reply.send({
      success: true,
      data: run,
    });
  });

  /**
   * Resume a failed/paused run
   */
  fastify.post('/runs/:runId/resume', async (request: FastifyRequest<{ Params: { runId: string }; Body: { fromState?: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;
    const { fromState } = request.body;

    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.runId, runId),
    });

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: 'Run not found',
      });
    }

    if (run.currentState !== 'FAILED') {
      return reply.status(400).send({
        success: false,
        error: 'Can only resume failed runs',
      });
    }

    // TODO: Trigger resume via job queue

    return reply.send({
      success: true,
      data: {
        runId: run.runId,
        resumeFromState: fromState || run.previousState,
      },
    });
  });

  /**
   * Rerun from a specific state
   */
  fastify.post('/runs/:runId/rerun', async (request: FastifyRequest<{ Params: { runId: string }; Query: { fromState: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;
    const { fromState } = request.query;

    if (!fromState) {
      return reply.status(400).send({
        success: false,
        error: 'fromState query parameter is required',
      });
    }

    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.runId, runId),
    });

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: 'Run not found',
      });
    }

    // TODO: Trigger rerun via job queue

    return reply.send({
      success: true,
      data: {
        originalRunId: runId,
        rerunFromState: fromState,
      },
    });
  });

  /**
   * Get artifacts for a run
   */
  fastify.get('/runs/:runId/artifacts', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.runId, runId),
      with: {
        artifacts: true,
      },
    });

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: 'Run not found',
      });
    }

    return reply.send({
      success: true,
      data: run.artifacts,
    });
  });

  /**
   * Get manifests for a module
   */
  fastify.get('/modules/:moduleId/manifests', async (request: FastifyRequest<{ Params: { moduleId: string } }>, reply: FastifyReply) => {
    const { moduleId } = request.params;

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: 'Module not found',
      });
    }

    const manifests = await db.query.artifacts.findMany({
      where: eq(schema.artifacts.artifactType, 'asset_manifest'),
      with: {
        run: {
          where: eq(schema.runs.moduleId, module.id),
        },
      },
    });

    return reply.send({
      success: true,
      data: manifests,
    });
  });
}
