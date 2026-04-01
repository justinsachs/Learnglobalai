/**
 * State Machine Engine
 * Manages pipeline state transitions with validation and checkpointing
 */

import {
  PipelineState,
  isValidTransition,
  getNextValidStates,
  isTerminalState,
  canResumeFrom,
  ARTIFACT_REQUIRED_STATES,
} from '@learnglobal/contracts';
import type {
  RunContext,
  StateHandler,
  StateHandlerResult,
  OrchestratorDependencies,
  StateCheckpoint,
} from '../types.js';
import { nanoid } from 'nanoid';

/**
 * State machine for the module pipeline
 */
export class PipelineStateMachine {
  private handlers: Map<PipelineState, StateHandler> = new Map();
  private dependencies: OrchestratorDependencies;

  constructor(dependencies: OrchestratorDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Register a handler for a specific state
   */
  registerHandler(state: PipelineState, handler: StateHandler): void {
    this.handlers.set(state, handler);
  }

  /**
   * Validate that a state transition is allowed
   */
  validateTransition(from: PipelineState | null, to: PipelineState): boolean {
    if (from === null) {
      // Initial state must be DRAFT_MODULE_SPEC
      return to === PipelineState.DRAFT_MODULE_SPEC;
    }
    return isValidTransition(from, to);
  }

  /**
   * Check if all required artifacts are present for a state
   */
  validateArtifactsForState(context: RunContext, state: PipelineState): string[] {
    const required = ARTIFACT_REQUIRED_STATES[state] || [];
    const missing: string[] = [];

    for (const artifact of required) {
      switch (artifact) {
        case 'moduleSpec':
          if (!context.moduleSpec) missing.push('moduleSpec');
          break;
        case 'outline':
          if (!context.outline) missing.push('outline');
          break;
        case 'sourcepack':
          if (!context.sourcePack) missing.push('sourcePack');
          break;
        case 'qaReport':
          if (!context.qaReport) missing.push('qaReport');
          break;
        case 'mediaPromptPack':
          if (!context.mediaPromptPack) missing.push('mediaPromptPack');
          break;
        case 'heygenPackage':
          if (!context.heygenPackage) missing.push('heygenPackage');
          break;
        case 'assetManifest':
          if (!context.assetManifest) missing.push('assetManifest');
          break;
      }
    }

    return missing;
  }

  /**
   * Execute the handler for a given state
   */
  async executeState(context: RunContext): Promise<StateHandlerResult> {
    const handler = this.handlers.get(context.currentState);

    if (!handler) {
      return {
        success: false,
        error: {
          code: 'NO_HANDLER',
          message: `No handler registered for state: ${context.currentState}`,
          recoverable: false,
          retryable: false,
        },
      };
    }

    // Validate artifacts
    const missingArtifacts = this.validateArtifactsForState(context, context.currentState);
    if (missingArtifacts.length > 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_ARTIFACTS',
          message: `Missing required artifacts for state ${context.currentState}: ${missingArtifacts.join(', ')}`,
          recoverable: false,
          retryable: false,
          context: { missingArtifacts },
        },
      };
    }

    const startTime = Date.now();

    try {
      this.dependencies.logger.info(`Executing state: ${context.currentState}`, {
        runId: context.runId,
        moduleId: context.moduleId,
      });

      const result = await handler(context, this.dependencies);

      const duration = Date.now() - startTime;

      if (result.success && result.nextState) {
        // Validate the transition
        if (!this.validateTransition(context.currentState, result.nextState)) {
          return {
            success: false,
            error: {
              code: 'INVALID_TRANSITION',
              message: `Invalid state transition from ${context.currentState} to ${result.nextState}`,
              recoverable: false,
              retryable: false,
            },
          };
        }

        // Log the transition
        await this.dependencies.logAuditEvent({
          runId: context.runId,
          moduleId: context.moduleId,
          eventType: 'state_transition',
          actor: 'orchestrator',
          fromState: context.currentState,
          toState: result.nextState,
          details: { durationMs: duration },
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.dependencies.logger.error(`State execution failed: ${context.currentState}`, {
        runId: context.runId,
        error: errorMessage,
      });

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
          recoverable: true,
          retryable: true,
          context: { state: context.currentState },
        },
      };
    }
  }

  /**
   * Run the pipeline from current state to completion or failure
   */
  async run(context: RunContext): Promise<RunContext> {
    let currentContext = { ...context };

    while (!isTerminalState(currentContext.currentState)) {
      const result = await this.executeState(currentContext);

      if (!result.success) {
        // Transition to FAILED state
        currentContext = {
          ...currentContext,
          previousState: currentContext.currentState,
          currentState: PipelineState.FAILED,
          error: result.error,
          completedAt: new Date().toISOString(),
        };

        await this.dependencies.saveRunState(currentContext);
        await this.dependencies.logAuditEvent({
          runId: currentContext.runId,
          moduleId: currentContext.moduleId,
          eventType: 'run_failed',
          actor: 'orchestrator',
          fromState: currentContext.previousState,
          toState: PipelineState.FAILED,
          details: { error: result.error },
        });

        break;
      }

      // Apply artifacts from result
      if (result.artifacts) {
        currentContext = { ...currentContext, ...result.artifacts };
      }

      // Transition to next state
      if (result.nextState) {
        currentContext = {
          ...currentContext,
          previousState: currentContext.currentState,
          currentState: result.nextState,
        };

        // Save checkpoint
        if (result.checkpoint) {
          currentContext.checkpoint = result.checkpoint;
        }

        await this.dependencies.saveRunState(currentContext);
      }

      // Check if we've reached a terminal state
      if (isTerminalState(currentContext.currentState)) {
        currentContext.completedAt = new Date().toISOString();
        await this.dependencies.saveRunState(currentContext);

        await this.dependencies.logAuditEvent({
          runId: currentContext.runId,
          moduleId: currentContext.moduleId,
          eventType: 'run_completed',
          actor: 'orchestrator',
          details: { finalState: currentContext.currentState },
        });
      }
    }

    return currentContext;
  }

  /**
   * Resume a run from a checkpoint
   */
  async resume(runId: string, fromState?: PipelineState): Promise<RunContext> {
    const context = await this.dependencies.loadRunState(runId);

    if (!context) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Determine the state to resume from
    let resumeState = fromState || context.currentState;

    if (context.currentState === PipelineState.FAILED && context.previousState) {
      // If failed, resume from the state before failure
      resumeState = fromState || context.previousState;
    }

    if (!canResumeFrom(resumeState)) {
      throw new Error(`Cannot resume from state: ${resumeState}`);
    }

    this.dependencies.logger.info(`Resuming run from state: ${resumeState}`, {
      runId,
      previousState: context.currentState,
    });

    await this.dependencies.logAuditEvent({
      runId,
      moduleId: context.moduleId,
      eventType: 'run_resumed',
      actor: 'orchestrator',
      fromState: context.currentState,
      toState: resumeState,
      details: {},
    });

    // Update context for resumption
    const resumedContext: RunContext = {
      ...context,
      previousState: context.currentState,
      currentState: resumeState,
      error: undefined, // Clear error on resume
    };

    return this.run(resumedContext);
  }

  /**
   * Partial rerun from a specific state
   */
  async rerunFromState(runId: string, fromState: PipelineState): Promise<RunContext> {
    const context = await this.dependencies.loadRunState(runId);

    if (!context) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Generate new run ID for the rerun
    const newRunId = `${context.moduleId}-${nanoid(10)}`;

    this.dependencies.logger.info(`Starting rerun from state: ${fromState}`, {
      originalRunId: runId,
      newRunId,
    });

    // Create new context preserving artifacts up to the fromState
    const rerunContext: RunContext = {
      ...context,
      runId: newRunId,
      currentState: fromState,
      previousState: undefined,
      error: undefined,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      triggeredBy: `rerun:${runId}`,
    };

    await this.dependencies.saveRunState(rerunContext);
    await this.dependencies.logAuditEvent({
      runId: newRunId,
      moduleId: context.moduleId,
      eventType: 'run_created',
      actor: 'orchestrator',
      details: {
        type: 'rerun',
        originalRunId: runId,
        fromState,
      },
    });

    return this.run(rerunContext);
  }

  /**
   * Create a checkpoint for the current state
   */
  createCheckpoint(context: RunContext): StateCheckpoint {
    return {
      state: context.currentState,
      timestamp: new Date().toISOString(),
      artifactHashes: {
        // These would be computed from actual artifact hashes
        ...(context.moduleSpec && { moduleSpec: 'computed' }),
        ...(context.outline && { outline: 'computed' }),
        ...(context.sourcePack && { sourcePack: 'computed' }),
        ...(context.qaReport && { qaReport: 'computed' }),
        ...(context.mediaPromptPack && { mediaPromptPack: 'computed' }),
        ...(context.heygenPackage && { heygenPackage: 'computed' }),
      },
      externalState: {
        notebookLm: context.notebookLmState,
        heygen: context.heygenState,
        lms: context.lmsState,
      },
    };
  }

  /**
   * Get available next states from current state
   */
  getAvailableTransitions(state: PipelineState): PipelineState[] {
    return getNextValidStates(state);
  }
}

export function createStateMachine(dependencies: OrchestratorDependencies): PipelineStateMachine {
  return new PipelineStateMachine(dependencies);
}
