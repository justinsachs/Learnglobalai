/**
 * HEYGEN_VIDEO_REQUESTED State Handler
 * Submits video generation request to HeyGen
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';

export async function handleHeyGenVideoRequested(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing HEYGEN_VIDEO_REQUESTED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  if (!deps.heygen) {
    deps.logger.info('HeyGen not configured, skipping', { runId: context.runId });
    return {
      success: true,
      nextState: PipelineState.LMS_PUBLISHED,
    };
  }

  try {
    const spec = context.moduleSpec;
    const heygenPackage = context.heygenPackage!;
    const verticalConfig = await deps.getVerticalConfig(spec.vertical);

    const avatarId = heygenPackage.avatarConfig.avatarId ||
                    verticalConfig.mediaConfig.avatarId ||
                    'default';

    const voiceId = heygenPackage.avatarConfig.voiceId ||
                   verticalConfig.mediaConfig.voiceId ||
                   'default';

    deps.logger.info('Submitting video generation request to HeyGen', {
      runId: context.runId,
      avatarId,
      voiceId,
      scriptLength: heygenPackage.narrationScript.length,
    });

    const { jobId } = await deps.heygen.createVideo(
      heygenPackage.narrationScript,
      avatarId,
      voiceId,
      {
        resolution: heygenPackage.videoSettings.resolution,
        aspectRatio: heygenPackage.videoSettings.aspectRatio,
        title: heygenPackage.title,
      }
    );

    deps.logger.info('HeyGen video job submitted', {
      runId: context.runId,
      jobId,
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'connector_called',
      actor: 'orchestrator',
      details: {
        connector: 'heygen',
        operation: 'createVideo',
        jobId,
      },
    });

    return {
      success: true,
      nextState: PipelineState.HEYGEN_VIDEO_READY,
      artifacts: {
        heygenState: {
          ...context.heygenState,
          jobId,
          status: 'processing',
          requestedAt: new Date().toISOString(),
          retryCount: context.heygenState?.retryCount || 0,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('HEYGEN_VIDEO_REQUESTED failed', { runId: context.runId, error: message });

    const retryCount = (context.heygenState?.retryCount || 0) + 1;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      deps.logger.info('Will retry HeyGen request', {
        runId: context.runId,
        retryCount,
        maxRetries,
      });

      return {
        success: false,
        error: {
          code: 'HEYGEN_REQUEST_ERROR',
          message,
          recoverable: true,
          retryable: true,
          retryAfterMs: Math.pow(2, retryCount) * 1000,
          context: { retryCount },
        },
        artifacts: {
          heygenState: {
            ...context.heygenState,
            status: 'pending',
            retryCount,
            error: message,
          },
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'HEYGEN_REQUEST_FAILED',
        message: `HeyGen request failed after ${maxRetries} retries: ${message}`,
        recoverable: false,
        retryable: false,
        suggestedAction: 'Check HeyGen API credentials and quotas',
      },
    };
  }
}
