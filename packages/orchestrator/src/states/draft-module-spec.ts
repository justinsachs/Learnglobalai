/**
 * DRAFT_MODULE_SPEC State Handler
 * Initial state - validates ModuleSpec and prepares for outline generation
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleDraftModuleSpec(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing DRAFT_MODULE_SPEC state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  try {
    // Validate ModuleSpec is present
    if (!context.moduleSpec) {
      return {
        success: false,
        error: {
          code: 'MISSING_MODULE_SPEC',
          message: 'ModuleSpec is required but not provided',
          recoverable: false,
          retryable: false,
        },
      };
    }

    const spec = context.moduleSpec;

    // Validate required fields
    const requiredFields = [
      'moduleId',
      'title',
      'vertical',
      'version',
      'author',
      'targetAudienceRoles',
      'learningObjectives',
      'constraints',
      'safetyBoundaries',
      'mediaPreferences',
    ];

    const missingFields = requiredFields.filter(
      (field) => !(field in spec) || spec[field as keyof typeof spec] === undefined
    );

    if (missingFields.length > 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_MODULE_SPEC',
          message: `Missing required fields: ${missingFields.join(', ')}`,
          recoverable: false,
          retryable: false,
          context: { missingFields },
        },
      };
    }

    // Validate learning objectives
    if (!Array.isArray(spec.learningObjectives) || spec.learningObjectives.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_LEARNING_OBJECTIVES',
          message: 'At least one learning objective is required',
          recoverable: false,
          retryable: false,
        },
      };
    }

    // Validate constraints
    if (spec.constraints.minTotalWords < 1000) {
      deps.logger.warn('Low minTotalWords setting', {
        runId: context.runId,
        minTotalWords: spec.constraints.minTotalWords,
      });
    }

    // Store ModuleSpec to content repository
    const specJson = JSON.stringify(spec, null, 2);
    const specHash = hashObject(spec);
    const storageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/module-spec.json`;

    const { uri } = await deps.contentRepo.putObject(storageKey, specJson, 'application/json');

    deps.logger.info('ModuleSpec stored', {
      runId: context.runId,
      uri,
      hash: specHash,
    });

    // Log audit event for artifact creation
    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'artifact_created',
      actor: 'orchestrator',
      details: {
        artifactType: 'module_spec',
        uri,
        hash: specHash,
      },
    });

    return {
      success: true,
      nextState: PipelineState.OUTLINE_GENERATED,
      checkpoint: {
        state: PipelineState.DRAFT_MODULE_SPEC,
        timestamp: new Date().toISOString(),
        artifactHashes: { moduleSpec: specHash },
        externalState: {},
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('DRAFT_MODULE_SPEC failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'DRAFT_SPEC_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}
