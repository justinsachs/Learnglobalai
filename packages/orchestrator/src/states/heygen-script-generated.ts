/**
 * HEYGEN_SCRIPT_GENERATED State Handler
 * Generates HeyGen video script from media prompt pack
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleHeyGenScriptGenerated(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing HEYGEN_SCRIPT_GENERATED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  if (!deps.heygen) {
    deps.logger.info('HeyGen not configured, skipping video generation', { runId: context.runId });
    return {
      success: true,
      nextState: PipelineState.LMS_PUBLISHED,
    };
  }

  try {
    const spec = context.moduleSpec;
    const mediaPromptPack = context.mediaPromptPack!;

    const verticalConfig = await deps.getVerticalConfig(spec.vertical);
    const template = verticalConfig.templates.heygenScript;

    deps.logger.info('Generating HeyGen script with LLM', { runId: context.runId });

    const { heygenPackage, usage } = await deps.llmProvider.generateHeyGenPackage(
      spec,
      mediaPromptPack,
      template
    );

    // Store HeyGen package
    const packageJson = JSON.stringify(heygenPackage, null, 2);
    const packageHash = hashObject(heygenPackage);
    const storageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/heygen-package.json`;

    const { uri } = await deps.contentRepo.putObject(storageKey, packageJson, 'application/json');

    deps.logger.info('HeyGen package generated and stored', {
      runId: context.runId,
      uri,
      hash: packageHash,
      estimatedDuration: heygenPackage.estimatedDurationSeconds,
      sceneCount: heygenPackage.sceneBreakdown.length,
      tokenUsage: usage,
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'artifact_created',
      actor: 'orchestrator',
      details: {
        artifactType: 'heygen_package',
        uri,
        hash: packageHash,
      },
    });

    return {
      success: true,
      nextState: PipelineState.HEYGEN_VIDEO_REQUESTED,
      artifacts: {
        heygenPackage,
        heygenState: {
          status: 'pending',
          retryCount: 0,
        },
      },
      checkpoint: {
        state: PipelineState.HEYGEN_SCRIPT_GENERATED,
        timestamp: new Date().toISOString(),
        artifactHashes: {
          ...context.checkpoint?.artifactHashes,
          heygenPackage: packageHash,
        },
        externalState: {
          notebookLm: context.notebookLmState,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('HEYGEN_SCRIPT_GENERATED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'HEYGEN_SCRIPT_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}
