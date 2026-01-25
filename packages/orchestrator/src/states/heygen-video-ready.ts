/**
 * HEYGEN_VIDEO_READY State Handler
 * Polls HeyGen for video completion and retrieves the video URL
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';

const MAX_POLL_ATTEMPTS = 60; // 10 minutes at 10-second intervals
const POLL_INTERVAL_MS = 10000;

export async function handleHeyGenVideoReady(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing HEYGEN_VIDEO_READY state - polling for completion', {
    runId: context.runId,
    moduleId: context.moduleId,
    jobId: context.heygenState?.jobId,
  });

  if (!deps.heygen || !context.heygenState?.jobId) {
    deps.logger.info('HeyGen not configured or no job ID, skipping', { runId: context.runId });
    return {
      success: true,
      nextState: PipelineState.LMS_PUBLISHED,
    };
  }

  try {
    const jobId = context.heygenState.jobId;
    let attempts = 0;
    let status: string = 'processing';
    let videoUrl: string | undefined;
    let error: string | undefined;

    // Poll for completion
    while (attempts < MAX_POLL_ATTEMPTS && status === 'processing') {
      deps.logger.debug('Polling HeyGen job status', {
        runId: context.runId,
        jobId,
        attempt: attempts + 1,
      });

      const result = await deps.heygen.pollStatus(jobId);
      status = result.status;
      videoUrl = result.videoUrl;
      error = result.error;

      if (status === 'processing') {
        await sleep(POLL_INTERVAL_MS);
        attempts++;
      }
    }

    if (status === 'completed' && videoUrl) {
      deps.logger.info('HeyGen video ready', {
        runId: context.runId,
        jobId,
        videoUrl,
      });

      await deps.logAuditEvent({
        runId: context.runId,
        moduleId: context.moduleId,
        eventType: 'connector_called',
        actor: 'orchestrator',
        details: {
          connector: 'heygen',
          operation: 'videoCompleted',
          jobId,
          videoUrl,
        },
      });

      return {
        success: true,
        nextState: PipelineState.LMS_PUBLISHED,
        artifacts: {
          heygenState: {
            ...context.heygenState,
            status: 'completed',
            videoUrl,
            completedAt: new Date().toISOString(),
          },
        },
      };
    }

    if (status === 'failed') {
      deps.logger.error('HeyGen video generation failed', {
        runId: context.runId,
        jobId,
        error,
      });

      return {
        success: false,
        error: {
          code: 'HEYGEN_VIDEO_FAILED',
          message: error || 'Video generation failed',
          recoverable: true,
          retryable: true,
          suggestedAction: 'Review the script and HeyGen settings, then retry',
        },
        artifacts: {
          heygenState: {
            ...context.heygenState,
            status: 'failed',
            error,
          },
        },
      };
    }

    // Timeout
    deps.logger.error('HeyGen video generation timed out', {
      runId: context.runId,
      jobId,
      attempts,
    });

    return {
      success: false,
      error: {
        code: 'HEYGEN_VIDEO_TIMEOUT',
        message: `Video generation timed out after ${attempts} polling attempts`,
        recoverable: true,
        retryable: true,
        suggestedAction: 'The video may still be processing. Try resuming the run later.',
      },
      artifacts: {
        heygenState: {
          ...context.heygenState,
          status: 'processing',
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('HEYGEN_VIDEO_READY failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'HEYGEN_POLL_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
