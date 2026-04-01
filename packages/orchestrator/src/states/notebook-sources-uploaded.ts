/**
 * NOTEBOOK_SOURCES_UPLOADED State Handler
 * Uploads SourcePack and prompt pack to NotebookLM
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';

export async function handleNotebookSourcesUploaded(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing NOTEBOOK_SOURCES_UPLOADED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  if (!deps.notebookLm || !context.notebookLmState?.notebookId) {
    deps.logger.info('NotebookLM not configured or notebook not created, skipping', { runId: context.runId });
    return {
      success: true,
      nextState: PipelineState.MEDIA_PROMPT_PACK_GENERATED,
    };
  }

  try {
    const spec = context.moduleSpec;
    const sourcePack = context.sourcePack!;
    const notebookId = context.notebookLmState.notebookId;
    const sourceIds: string[] = [];

    // Generate markdown for upload
    const sourcePackMarkdown = generateMarkdownForNotebook(sourcePack);

    // Upload SourcePack
    const { sourceId: sourcePackId } = await deps.notebookLm.uploadSource(
      notebookId,
      `${spec.title} - Training Content`,
      sourcePackMarkdown
    );
    sourceIds.push(sourcePackId);

    deps.logger.info('SourcePack uploaded to NotebookLM', {
      runId: context.runId,
      sourceId: sourcePackId,
    });

    // Share notebook
    const { shareUrl } = await deps.notebookLm.shareNotebook(notebookId);

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'connector_called',
      actor: 'orchestrator',
      details: {
        connector: 'notebooklm',
        operation: 'uploadSources',
        sourceIds,
        shareUrl,
      },
    });

    return {
      success: true,
      nextState: PipelineState.MEDIA_PROMPT_PACK_GENERATED,
      artifacts: {
        notebookLmState: {
          ...context.notebookLmState,
          sourceIds,
          shareUrl,
          lastSyncedAt: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('NOTEBOOK_SOURCES_UPLOADED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'NOTEBOOK_UPLOAD_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}

function generateMarkdownForNotebook(sourcePack: import('@learnglobal/contracts').SourcePack): string {
  // Simplified markdown generation - full implementation in sourcepack-generated.ts
  const lines: string[] = [];
  lines.push(`# ${sourcePack.title}`);
  lines.push('');
  lines.push(sourcePack.abstract);
  lines.push('');

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
