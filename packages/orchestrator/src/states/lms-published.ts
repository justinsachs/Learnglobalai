/**
 * LMS_PUBLISHED State Handler
 * Publishes module to LMS
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';

export async function handleLmsPublished(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing LMS_PUBLISHED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  if (context.config.skipLmsPublish === true) {
    deps.logger.info('LMS publishing skipped by config', { runId: context.runId });
    return {
      success: true,
      nextState: context.config.skipChat === true
        ? PipelineState.AUDIT_FINALIZED
        : PipelineState.CHAT_CONFIGURED,
    };
  }

  try {
    const spec = context.moduleSpec;
    const sourcePack = context.sourcePack!;

    // Create module in LMS
    deps.logger.info('Creating module in LMS', { runId: context.runId });

    const { modulePageId, moduleUrl } = await deps.lms.createModule(
      spec.title,
      spec.description,
      {
        vertical: spec.vertical,
        version: spec.version,
        author: spec.author,
        runId: context.runId,
      }
    );

    const assetIds: string[] = [];

    // Upload SourcePack as document
    const sourcePackMarkdown = generateLmsMarkdown(sourcePack);
    const { assetId: docAssetId } = await deps.lms.uploadAsset(
      modulePageId,
      'document',
      `${spec.title} - Training Manual`,
      sourcePackMarkdown
    );
    assetIds.push(docAssetId);

    await deps.lms.attachAsset(modulePageId, docAssetId, 'main-content', 1);

    // Upload video if available
    if (context.heygenState?.videoUrl) {
      const { assetId: videoAssetId } = await deps.lms.uploadAsset(
        modulePageId,
        'video',
        `${spec.title} - Training Video`,
        context.heygenState.videoUrl
      );
      assetIds.push(videoAssetId);

      await deps.lms.attachAsset(modulePageId, videoAssetId, 'video-content', 2);
    }

    // Check if approval is required
    if (context.config.autoApprove === true) {
      // Auto-publish in dev mode
      const { moduleUrl: publishedUrl } = await deps.lms.publish(modulePageId, 'system');

      deps.logger.info('Module published to LMS', {
        runId: context.runId,
        modulePageId,
        moduleUrl: publishedUrl,
      });

      await deps.logAuditEvent({
        runId: context.runId,
        moduleId: context.moduleId,
        eventType: 'connector_called',
        actor: 'orchestrator',
        details: {
          connector: 'lms',
          operation: 'publish',
          modulePageId,
          moduleUrl: publishedUrl,
          assetIds,
        },
      });

      return {
        success: true,
        nextState: context.config.skipChat === true
          ? PipelineState.AUDIT_FINALIZED
          : PipelineState.CHAT_CONFIGURED,
        artifacts: {
          lmsState: {
            modulePageId,
            moduleUrl: publishedUrl,
            assetIds,
            status: 'published',
            publishedAt: new Date().toISOString(),
            publishedBy: 'system',
          },
        },
      };
    } else {
      // Approval required - save as draft
      deps.logger.info('Module saved as draft, approval required', {
        runId: context.runId,
        modulePageId,
      });

      await deps.logAuditEvent({
        runId: context.runId,
        moduleId: context.moduleId,
        eventType: 'approval_requested',
        actor: 'orchestrator',
        details: {
          modulePageId,
          moduleUrl,
        },
      });

      return {
        success: true,
        nextState: context.config.skipChat === true
          ? PipelineState.AUDIT_FINALIZED
          : PipelineState.CHAT_CONFIGURED,
        artifacts: {
          lmsState: {
            modulePageId,
            moduleUrl,
            assetIds,
            status: 'pending_approval',
          },
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('LMS_PUBLISHED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'LMS_PUBLISH_ERROR',
        message,
        recoverable: true,
        retryable: true,
        suggestedAction: 'Check LMS API configuration and permissions',
      },
    };
  }
}

function generateLmsMarkdown(sourcePack: import('@learnglobal/contracts').SourcePack): string {
  // Generate HTML-friendly markdown for LMS
  const lines: string[] = [];

  lines.push(`# ${sourcePack.title}`);
  lines.push('');
  lines.push(sourcePack.abstract);
  lines.push('');

  if (sourcePack.disclaimers.length > 0) {
    lines.push('---');
    lines.push('**Important Notices:**');
    for (const d of sourcePack.disclaimers) {
      lines.push(`> ${d}`);
    }
    lines.push('---');
    lines.push('');
  }

  const renderSection = (section: typeof sourcePack.sections[0], depth: number = 2): void => {
    const prefix = '#'.repeat(Math.min(depth, 6));
    lines.push(`${prefix} ${section.heading}`);
    lines.push('');
    lines.push(section.fullProseText);
    lines.push('');

    if (section.children) {
      for (const child of section.children) {
        renderSection(child, depth + 1);
      }
    }
  };

  for (const section of sourcePack.sections) {
    renderSection(section);
  }

  return lines.join('\n');
}
