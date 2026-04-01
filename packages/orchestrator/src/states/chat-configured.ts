/**
 * CHAT_CONFIGURED State Handler
 * Configures module-specific chat with RAG
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';

export async function handleChatConfigured(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing CHAT_CONFIGURED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  if (context.config.skipChat === true || !deps.chat) {
    deps.logger.info('Chat configuration skipped', { runId: context.runId });
    return {
      success: true,
      nextState: PipelineState.AUDIT_FINALIZED,
    };
  }

  try {
    const spec = context.moduleSpec;
    const sourcePack = context.sourcePack!;

    // Prepare sources for indexing
    const sources: Array<{ id: string; content: string }> = [];

    // Add main source pack content
    const collectSectionContent = (sections: typeof sourcePack.sections): void => {
      for (const section of sections) {
        sources.push({
          id: `section-${section.id}`,
          content: `# ${section.heading}\n\n${section.fullProseText}`,
        });

        if (section.embeddedScenarios) {
          for (const scenario of section.embeddedScenarios) {
            sources.push({
              id: `scenario-${scenario.scenarioId}`,
              content: `Scenario: ${scenario.title}\n\nSetting: ${scenario.setting}\n\n${scenario.dialogue.map(d => `${d.speaker}: ${d.text}`).join('\n')}`,
            });
          }
        }

        if (section.children) {
          collectSectionContent(section.children);
        }
      }
    };
    collectSectionContent(sourcePack.sections);

    // Add standards as reference sources
    for (const standard of spec.standardsMap) {
      sources.push({
        id: `standard-${standard.standardName}-${standard.sectionRef}`,
        content: `Standard: ${standard.standardName}\nSection: ${standard.sectionRef}\n\n${standard.requirementSummary}${standard.fullText ? `\n\nFull Text:\n${standard.fullText}` : ''}`,
      });
    }

    // Create chat configuration
    deps.logger.info('Creating chat configuration', {
      runId: context.runId,
      sourceCount: sources.length,
    });

    const { configId, indexId } = await deps.chat.createConfig(
      context.moduleId,
      sources
    );

    // Index sources
    const { indexed } = await deps.chat.indexSources(configId, sources);

    deps.logger.info('Chat configured', {
      runId: context.runId,
      configId,
      indexId,
      sourcesIndexed: indexed,
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'connector_called',
      actor: 'orchestrator',
      details: {
        connector: 'chat',
        operation: 'configureChat',
        configId,
        indexId,
        sourcesIndexed: indexed,
      },
    });

    return {
      success: true,
      nextState: PipelineState.AUDIT_FINALIZED,
      artifacts: {
        chatState: {
          configId,
          retrievalIndexId: indexId,
          policyId: `policy-${spec.vertical}`,
          sourcesIndexed: indexed,
          configuredAt: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('CHAT_CONFIGURED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'CHAT_CONFIG_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}
