/**
 * OUTLINE_GENERATED State Handler
 * Generates hierarchical outline from ModuleSpec using LLM
 */

import { PipelineState, type Outline } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleOutlineGenerated(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing OUTLINE_GENERATED state - generating outline', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  try {
    const spec = context.moduleSpec;

    // Get vertical configuration for template
    const verticalConfig = await deps.getVerticalConfig(spec.vertical);
    const template = verticalConfig.templates.outline;

    deps.logger.info('Generating outline with LLM', {
      runId: context.runId,
      model: 'configured',
    });

    // Generate outline using LLM
    const { outline, usage } = await deps.llmProvider.generateOutline(spec, template);

    // Validate outline structure
    if (!outline.headings || outline.headings.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_OUTLINE',
          message: 'Generated outline has no headings',
          recoverable: true,
          retryable: true,
        },
      };
    }

    // Validate all learning objectives are mapped
    const mappedObjectives = new Set<number>();
    const collectMappedObjectives = (headings: Outline['headings']): void => {
      for (const heading of headings) {
        heading.mapping.learningObjectiveIndices.forEach((i) => mappedObjectives.add(i));
        if (heading.children) {
          collectMappedObjectives(heading.children);
        }
      }
    };
    collectMappedObjectives(outline.headings);

    const unmappedObjectives = spec.learningObjectives
      .map((_, i) => i)
      .filter((i) => !mappedObjectives.has(i));

    if (unmappedObjectives.length > 0) {
      deps.logger.warn('Some learning objectives are not mapped in outline', {
        runId: context.runId,
        unmappedIndices: unmappedObjectives,
      });
    }

    // Store outline to content repository
    const outlineJson = JSON.stringify(outline, null, 2);
    const outlineHash = hashObject(outline);
    const storageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/outline.json`;

    const { uri } = await deps.contentRepo.putObject(storageKey, outlineJson, 'application/json');

    deps.logger.info('Outline generated and stored', {
      runId: context.runId,
      uri,
      hash: outlineHash,
      headingCount: outline.headings.length,
      estimatedWords: outline.totalEstimatedWordCount,
      tokenUsage: usage,
    });

    // Log audit events
    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'llm_called',
      actor: 'orchestrator',
      details: {
        operation: 'generate_outline',
        tokenUsage: usage,
      },
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'artifact_created',
      actor: 'orchestrator',
      details: {
        artifactType: 'outline',
        uri,
        hash: outlineHash,
      },
    });

    return {
      success: true,
      nextState: PipelineState.SOURCEPACK_GENERATED,
      artifacts: { outline },
      checkpoint: {
        state: PipelineState.OUTLINE_GENERATED,
        timestamp: new Date().toISOString(),
        artifactHashes: {
          moduleSpec: context.checkpoint?.artifactHashes.moduleSpec || 'unknown',
          outline: outlineHash,
        },
        externalState: {},
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('OUTLINE_GENERATED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'OUTLINE_GENERATION_ERROR',
        message,
        recoverable: true,
        retryable: true,
        suggestedAction: 'Check LLM provider configuration and retry',
      },
    };
  }
}
