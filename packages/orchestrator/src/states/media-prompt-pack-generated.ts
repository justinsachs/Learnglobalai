/**
 * MEDIA_PROMPT_PACK_GENERATED State Handler
 * Generates media prompt pack for audio/video/infographic generation
 */

import { PipelineState } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleMediaPromptPackGenerated(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing MEDIA_PROMPT_PACK_GENERATED state', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  try {
    const spec = context.moduleSpec;
    const sourcePack = context.sourcePack!;

    const verticalConfig = await deps.getVerticalConfig(spec.vertical);
    const template = verticalConfig.templates.mediaPromptPack;

    deps.logger.info('Generating MediaPromptPack with LLM', { runId: context.runId });

    const { mediaPromptPack, usage } = await deps.llmProvider.generateMediaPromptPack(
      spec,
      sourcePack,
      template
    );

    // Store MediaPromptPack
    const packJson = JSON.stringify(mediaPromptPack, null, 2);
    const packHash = hashObject(mediaPromptPack);
    const jsonKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/media-prompt-pack.json`;

    const { uri: jsonUri } = await deps.contentRepo.putObject(jsonKey, packJson, 'application/json');

    // Generate markdown version for NotebookLM "RUN PROMPTS" doc
    const markdown = generateMediaPromptPackMarkdown(mediaPromptPack);
    const mdKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/media-prompt-pack.md`;

    const { uri: mdUri } = await deps.contentRepo.putObject(mdKey, markdown, 'text/markdown');

    // Upload to NotebookLM if available
    if (deps.notebookLm && context.notebookLmState?.notebookId) {
      try {
        const { sourceId: promptDocId } = await deps.notebookLm.uploadSource(
          context.notebookLmState.notebookId,
          'RUN PROMPTS - Media Generation',
          markdown
        );
        context.notebookLmState.promptDocId = promptDocId;

        deps.logger.info('MediaPromptPack uploaded to NotebookLM', {
          runId: context.runId,
          promptDocId,
        });
      } catch (error) {
        deps.logger.warn('Failed to upload prompt pack to NotebookLM', {
          runId: context.runId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    deps.logger.info('MediaPromptPack generated and stored', {
      runId: context.runId,
      jsonUri,
      mdUri,
      hash: packHash,
      tokenUsage: usage,
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'artifact_created',
      actor: 'orchestrator',
      details: {
        artifactType: 'media_prompt_pack',
        jsonUri,
        mdUri,
        hash: packHash,
      },
    });

    // Determine next state
    let nextState: PipelineState;
    if (context.config.skipHeygen !== true && deps.heygen) {
      nextState = PipelineState.HEYGEN_SCRIPT_GENERATED;
    } else if (context.config.skipLmsPublish !== true) {
      nextState = PipelineState.LMS_PUBLISHED;
    } else {
      nextState = PipelineState.CHAT_CONFIGURED;
    }

    return {
      success: true,
      nextState,
      artifacts: {
        mediaPromptPack,
        notebookLmState: context.notebookLmState,
      },
      checkpoint: {
        state: PipelineState.MEDIA_PROMPT_PACK_GENERATED,
        timestamp: new Date().toISOString(),
        artifactHashes: {
          ...context.checkpoint?.artifactHashes,
          mediaPromptPack: packHash,
        },
        externalState: {
          notebookLm: context.notebookLmState,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('MEDIA_PROMPT_PACK_GENERATED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'MEDIA_PROMPT_PACK_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}

function generateMediaPromptPackMarkdown(pack: import('@learnglobal/contracts').MediaPromptPack): string {
  const lines: string[] = [];

  lines.push('# Media Generation Prompts');
  lines.push('');
  lines.push(`**Module:** ${pack.moduleId}`);
  lines.push(`**Version:** ${pack.version}`);
  lines.push(`**Generated:** ${pack.generatedAt}`);
  lines.push('');

  // Audio prompt
  lines.push('## Audio Generation');
  lines.push('');
  lines.push(`**Tone:** ${pack.audioPrompt.tone}`);
  lines.push(`**Target Duration:** ${pack.audioPrompt.targetDurationMinutes} minutes`);
  lines.push('');
  lines.push('### Introduction');
  lines.push(pack.audioPrompt.introScript);
  lines.push('');
  lines.push('### Talking Points');
  for (const point of pack.audioPrompt.talkingPoints) {
    lines.push(`- ${point}`);
  }
  lines.push('');
  lines.push('### Closing');
  lines.push(pack.audioPrompt.closingScript);
  lines.push('');

  // Video prompt
  lines.push('## Video Generation');
  lines.push('');
  lines.push(`**Tone:** ${pack.videoPrompt.tone}`);
  lines.push(`**Target Duration:** ${pack.videoPrompt.targetDurationMinutes} minutes`);
  lines.push('');
  lines.push('### Shot List');
  for (const shot of pack.videoPrompt.shotList) {
    lines.push(`**Shot ${shot.shotNumber}** (${shot.durationSeconds}s) - ${shot.visualType}`);
    lines.push(`- ${shot.description}`);
    if (shot.onScreenText) {
      lines.push(`- On-screen: "${shot.onScreenText}"`);
    }
    lines.push('');
  }

  // Infographic spec
  lines.push('## Infographic Specification');
  lines.push('');
  lines.push(`**Title:** ${pack.infographicSpec.title}`);
  lines.push(`**Layout:** ${pack.infographicSpec.layout}`);
  lines.push('');
  lines.push('### Blocks');
  for (const block of pack.infographicSpec.blocks) {
    lines.push(`**${block.order}. ${block.type}** ${block.title || ''}`);
    lines.push(block.content);
    lines.push('');
  }

  // Constraints
  lines.push('## Constraints');
  lines.push('');
  lines.push(`- Max Length: ${pack.constraints.maxLengthMinutes} minutes`);
  lines.push(`- Min Length: ${pack.constraints.minLengthMinutes} minutes`);
  lines.push(`- Tone: ${pack.constraints.tone}`);
  lines.push('');
  lines.push('### Prohibited Claims');
  for (const claim of pack.constraints.prohibitedClaims) {
    lines.push(`- ${claim}`);
  }
  lines.push('');
  lines.push('### Required Disclaimers');
  for (const disclaimer of pack.constraints.requiredDisclaimers) {
    lines.push(`- ${disclaimer}`);
  }

  return lines.join('\n');
}
