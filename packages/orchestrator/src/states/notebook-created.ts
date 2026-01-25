/**
 * NOTEBOOK_CREATED State Handler
 * Creates NotebookLM notebook for the module
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';

export async function handleNotebookCreated(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing NOTEBOOK_CREATED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  // Check if NotebookLM is available
  if (!deps.notebookLm) {
    deps.logger.info('NotebookLM not configured, skipping', { runId: context.runId });
    return {
      success: true,
      nextState: PipelineState.MEDIA_PROMPT_PACK_GENERATED,
    };
  }

  try {
    const spec = context.moduleSpec;
    const verticalConfig = await deps.getVerticalConfig(spec.vertical);

    // Create notebook
    const notebookTitle = `${spec.title} - Training Module`;
    const { notebookId } = await deps.notebookLm.createNotebook(
      notebookTitle,
      verticalConfig.vertical // project ID placeholder
    );

    deps.logger.info('NotebookLM notebook created', {
      runId: context.runId,
      notebookId,
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'connector_called',
      actor: 'orchestrator',
      details: {
        connector: 'notebooklm',
        operation: 'createNotebook',
        notebookId,
      },
    });

    return {
      success: true,
      nextState: PipelineState.NOTEBOOK_SOURCES_UPLOADED,
      artifacts: {
        notebookLmState: {
          notebookId,
          sourceIds: [],
          createdAt: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('NOTEBOOK_CREATED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'NOTEBOOK_CREATION_ERROR',
        message,
        recoverable: true,
        retryable: true,
        suggestedAction: 'Check NotebookLM API configuration and credentials',
      },
    };
  }
}
