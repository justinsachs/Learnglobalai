/**
 * @learnglobal/orchestrator
 *
 * Pipeline orchestrator with state machine for the LearnGlobal.ai
 * Module-to-Assets pipeline.
 */

import { PipelineState } from '@learnglobal/contracts';
import { PipelineStateMachine, createStateMachine } from './engine/state-machine.js';
import {
  handleDraftModuleSpec,
  handleOutlineGenerated,
  handleSourcePackGenerated,
  handleQAPassed,
  handleNotebookCreated,
  handleNotebookSourcesUploaded,
  handleMediaPromptPackGenerated,
  handleHeyGenScriptGenerated,
  handleHeyGenVideoRequested,
  handleHeyGenVideoReady,
  handleLmsPublished,
  handleChatConfigured,
  handleAuditFinalized,
} from './states/index.js';
import type {
  RunContext,
  RunConfig,
  OrchestratorDependencies,
  StateHandlerResult,
} from './types.js';
import { nanoid } from 'nanoid';

// Re-export types
export * from './types.js';
export { PipelineStateMachine, createStateMachine } from './engine/state-machine.js';
export { hashObject } from './utils/hash.js';

/**
 * Create a fully configured orchestrator
 */
export function createOrchestrator(
  dependencies: OrchestratorDependencies
): PipelineStateMachine {
  const stateMachine = createStateMachine(dependencies);

  // Register all state handlers
  stateMachine.registerHandler(PipelineState.DRAFT_MODULE_SPEC, handleDraftModuleSpec);
  stateMachine.registerHandler(PipelineState.OUTLINE_GENERATED, handleOutlineGenerated);
  stateMachine.registerHandler(PipelineState.SOURCEPACK_GENERATED, handleSourcePackGenerated);
  stateMachine.registerHandler(PipelineState.QA_PASSED, handleQAPassed);
  stateMachine.registerHandler(PipelineState.NOTEBOOK_CREATED, handleNotebookCreated);
  stateMachine.registerHandler(PipelineState.NOTEBOOK_SOURCES_UPLOADED, handleNotebookSourcesUploaded);
  stateMachine.registerHandler(PipelineState.MEDIA_PROMPT_PACK_GENERATED, handleMediaPromptPackGenerated);
  stateMachine.registerHandler(PipelineState.HEYGEN_SCRIPT_GENERATED, handleHeyGenScriptGenerated);
  stateMachine.registerHandler(PipelineState.HEYGEN_VIDEO_REQUESTED, handleHeyGenVideoRequested);
  stateMachine.registerHandler(PipelineState.HEYGEN_VIDEO_READY, handleHeyGenVideoReady);
  stateMachine.registerHandler(PipelineState.LMS_PUBLISHED, handleLmsPublished);
  stateMachine.registerHandler(PipelineState.CHAT_CONFIGURED, handleChatConfigured);
  stateMachine.registerHandler(PipelineState.AUDIT_FINALIZED, handleAuditFinalized);

  return stateMachine;
}

/**
 * Create initial run context from a module spec
 */
export function createRunContext(
  moduleSpec: import('@learnglobal/contracts').ModuleSpec,
  triggeredBy: string,
  config: RunConfig = {}
): RunContext {
  const runId = `${moduleSpec.moduleId}-${nanoid(10)}`;

  return {
    runId,
    moduleId: moduleSpec.moduleId,
    version: moduleSpec.version,
    currentState: PipelineState.DRAFT_MODULE_SPEC,
    startedAt: new Date().toISOString(),
    triggeredBy,
    config,
    moduleSpec,
    metadata: {},
  };
}

/**
 * Orchestrator service interface
 */
export interface OrchestratorService {
  /**
   * Start a new pipeline run
   */
  startRun(
    moduleSpec: import('@learnglobal/contracts').ModuleSpec,
    triggeredBy: string,
    config?: RunConfig
  ): Promise<RunContext>;

  /**
   * Resume a paused or failed run
   */
  resumeRun(runId: string, fromState?: PipelineState): Promise<RunContext>;

  /**
   * Rerun from a specific state
   */
  rerunFromState(runId: string, fromState: PipelineState): Promise<RunContext>;

  /**
   * Get current run status
   */
  getRunStatus(runId: string): Promise<RunContext | null>;

  /**
   * Pause a running pipeline (at next checkpoint)
   */
  pauseRun(runId: string): Promise<void>;

  /**
   * Cancel a run
   */
  cancelRun(runId: string, reason: string): Promise<void>;
}

/**
 * Create orchestrator service
 */
export function createOrchestratorService(
  dependencies: OrchestratorDependencies
): OrchestratorService {
  const orchestrator = createOrchestrator(dependencies);

  return {
    async startRun(moduleSpec, triggeredBy, config = {}) {
      const context = createRunContext(moduleSpec, triggeredBy, config);

      dependencies.logger.info('Starting new pipeline run', {
        runId: context.runId,
        moduleId: context.moduleId,
      });

      await dependencies.saveRunState(context);
      await dependencies.logAuditEvent({
        runId: context.runId,
        moduleId: context.moduleId,
        eventType: 'run_created',
        actor: triggeredBy,
        details: {
          version: moduleSpec.version,
          vertical: moduleSpec.vertical,
          config,
        },
      });

      return orchestrator.run(context);
    },

    async resumeRun(runId, fromState) {
      dependencies.logger.info('Resuming pipeline run', { runId, fromState });
      return orchestrator.resume(runId, fromState);
    },

    async rerunFromState(runId, fromState) {
      dependencies.logger.info('Rerunning from state', { runId, fromState });
      return orchestrator.rerunFromState(runId, fromState);
    },

    async getRunStatus(runId) {
      return dependencies.loadRunState(runId);
    },

    async pauseRun(runId) {
      const context = await dependencies.loadRunState(runId);
      if (!context) {
        throw new Error(`Run not found: ${runId}`);
      }

      dependencies.logger.info('Pausing pipeline run', { runId });

      // Mark run as paused by setting a flag in metadata
      const pausedContext: RunContext = {
        ...context,
        metadata: {
          ...context.metadata,
          paused: true,
          pausedAt: new Date().toISOString(),
        },
      };

      await dependencies.saveRunState(pausedContext);
      await dependencies.logAuditEvent({
        runId,
        moduleId: context.moduleId,
        eventType: 'run_paused' as any,
        actor: 'system',
        details: { pausedAt: context.currentState },
      });
    },

    async cancelRun(runId, reason) {
      const context = await dependencies.loadRunState(runId);
      if (!context) {
        throw new Error(`Run not found: ${runId}`);
      }

      dependencies.logger.info('Cancelling pipeline run', { runId, reason });

      const cancelledContext: RunContext = {
        ...context,
        currentState: PipelineState.FAILED,
        error: {
          code: 'RUN_CANCELLED',
          message: reason,
          recoverable: false,
          retryable: false,
        },
        completedAt: new Date().toISOString(),
      };

      await dependencies.saveRunState(cancelledContext);
      await dependencies.logAuditEvent({
        runId,
        moduleId: context.moduleId,
        eventType: 'run_failed',
        actor: 'system',
        details: { reason, cancelled: true },
      });
    },
  };
}
