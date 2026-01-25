/**
 * SOURCEPACK_GENERATED State Handler
 * Generates full prose SourcePack from Outline using LLM
 */

import { PipelineState, type SourcePack } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleSourcePackGenerated(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing SOURCEPACK_GENERATED state - generating full prose content', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  try {
    const spec = context.moduleSpec;
    const outline = context.outline!;

    // Get vertical configuration for template
    const verticalConfig = await deps.getVerticalConfig(spec.vertical);
    const template = verticalConfig.templates.sourcepack;

    deps.logger.info('Generating SourcePack with LLM', {
      runId: context.runId,
      outlineHeadings: outline.headings.length,
    });

    // Generate SourcePack using LLM
    const { sourcePack, usage } = await deps.llmProvider.generateSourcePack(spec, outline, template);

    // Validate SourcePack structure
    if (!sourcePack.sections || sourcePack.sections.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_SOURCEPACK',
          message: 'Generated SourcePack has no sections',
          recoverable: true,
          retryable: true,
        },
      };
    }

    // Calculate total word count
    let totalWords = 0;
    const countWords = (sections: SourcePack['sections']): void => {
      for (const section of sections) {
        totalWords += section.wordCount;
        if (section.children) {
          countWords(section.children);
        }
      }
    };
    countWords(sourcePack.sections);

    deps.logger.info('SourcePack word count calculated', {
      runId: context.runId,
      totalWords,
      requiredMinimum: spec.constraints.minTotalWords,
    });

    // Store SourcePack JSON to content repository
    const sourcePackJson = JSON.stringify(sourcePack, null, 2);
    const sourcePackHash = hashObject(sourcePack);
    const jsonStorageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/sourcepack.json`;

    const { uri: jsonUri } = await deps.contentRepo.putObject(
      jsonStorageKey,
      sourcePackJson,
      'application/json'
    );

    // Generate Markdown version for NotebookLM
    const markdown = generateSourcePackMarkdown(sourcePack, spec);
    const mdStorageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/sourcepack.md`;

    const { uri: mdUri } = await deps.contentRepo.putObject(mdStorageKey, markdown, 'text/markdown');

    deps.logger.info('SourcePack generated and stored', {
      runId: context.runId,
      jsonUri,
      mdUri,
      hash: sourcePackHash,
      totalWords,
      sectionCount: sourcePack.sections.length,
      tokenUsage: usage,
    });

    // Log audit events
    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'llm_called',
      actor: 'orchestrator',
      details: {
        operation: 'generate_sourcepack',
        tokenUsage: usage,
      },
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'artifact_created',
      actor: 'orchestrator',
      details: {
        artifactType: 'sourcepack_json',
        uri: jsonUri,
        hash: sourcePackHash,
        wordCount: totalWords,
      },
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'artifact_created',
      actor: 'orchestrator',
      details: {
        artifactType: 'sourcepack_markdown',
        uri: mdUri,
      },
    });

    // Proceed to QA validation
    return {
      success: true,
      nextState: PipelineState.QA_PASSED, // Will run QA validation
      artifacts: { sourcePack },
      checkpoint: {
        state: PipelineState.SOURCEPACK_GENERATED,
        timestamp: new Date().toISOString(),
        artifactHashes: {
          ...context.checkpoint?.artifactHashes,
          sourcePack: sourcePackHash,
        },
        externalState: {},
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('SOURCEPACK_GENERATED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'SOURCEPACK_GENERATION_ERROR',
        message,
        recoverable: true,
        retryable: true,
        suggestedAction: 'Check LLM provider configuration and retry',
      },
    };
  }
}

/**
 * Generate Markdown from SourcePack for NotebookLM ingestion
 */
function generateSourcePackMarkdown(sourcePack: SourcePack, spec: { title: string; version: string }): string {
  const lines: string[] = [];

  // Front matter
  lines.push('---');
  lines.push(`title: "${sourcePack.title}"`);
  lines.push(`moduleId: "${sourcePack.moduleId}"`);
  lines.push(`version: "${sourcePack.version}"`);
  lines.push(`generatedAt: "${sourcePack.generatedAt}"`);
  lines.push('---');
  lines.push('');

  // Title and abstract
  lines.push(`# ${sourcePack.title}`);
  lines.push('');
  lines.push(sourcePack.abstract);
  lines.push('');

  // Disclaimers
  if (sourcePack.disclaimers.length > 0) {
    lines.push('## Important Notices');
    lines.push('');
    for (const disclaimer of sourcePack.disclaimers) {
      lines.push(`> ${disclaimer}`);
      lines.push('');
    }
  }

  // Render sections recursively
  const renderSection = (section: SourcePack['sections'][0], depth: number = 2): void => {
    const headingPrefix = '#'.repeat(Math.min(depth, 6));
    lines.push(`${headingPrefix} ${section.heading}`);
    lines.push('');
    lines.push(section.fullProseText);
    lines.push('');

    // Embedded scenarios
    if (section.embeddedScenarios && section.embeddedScenarios.length > 0) {
      for (const scenario of section.embeddedScenarios) {
        lines.push(`### Scenario: ${scenario.title}`);
        lines.push('');
        lines.push(`**Setting:** ${scenario.setting}`);
        lines.push('');
        lines.push('**Characters:**');
        for (const char of scenario.characters) {
          lines.push(`- **${char.name}** (${char.role}): ${char.description}`);
        }
        lines.push('');
        lines.push('**Dialogue:**');
        lines.push('');
        for (const line of scenario.dialogue) {
          lines.push(`**${line.speaker}** _(${line.role})_: ${line.text}`);
          if (line.directions) {
            lines.push(`_[${line.directions}]_`);
          }
          lines.push('');
        }
        lines.push('**Key Learning Points:**');
        for (const point of scenario.keyLearningPoints) {
          lines.push(`- ${point}`);
        }
        lines.push('');
      }
    }

    // Embedded checklists
    if (section.embeddedChecklists && section.embeddedChecklists.length > 0) {
      for (const checklist of section.embeddedChecklists) {
        lines.push(`### Checklist: ${checklist.title}`);
        lines.push('');
        lines.push(checklist.introduction);
        lines.push('');
        for (const item of checklist.items) {
          const critical = item.isCritical ? ' **(CRITICAL)**' : '';
          lines.push(`- [ ] ${item.text}${critical}`);
          if (item.notes) {
            lines.push(`  - _Note: ${item.notes}_`);
          }
        }
        lines.push('');
        if (checklist.closingNotes) {
          lines.push(checklist.closingNotes);
          lines.push('');
        }
      }
    }

    // Traceability
    if (section.traceability.length > 0) {
      lines.push('');
      lines.push('_Standards addressed in this section:_');
      for (const trace of section.traceability) {
        lines.push(`- ${trace.standardName} (${trace.sectionRef}): ${trace.howAddressed}`);
      }
      lines.push('');
    }

    // Render children
    if (section.children) {
      for (const child of section.children) {
        renderSection(child, depth + 1);
      }
    }
  };

  for (const section of sourcePack.sections) {
    renderSection(section);
  }

  // Glossary
  if (sourcePack.glossary && sourcePack.glossary.length > 0) {
    lines.push('## Glossary');
    lines.push('');
    for (const term of sourcePack.glossary) {
      lines.push(`**${term.term}**: ${term.definition}`);
      lines.push('');
    }
  }

  // References
  if (sourcePack.references && sourcePack.references.length > 0) {
    lines.push('## References');
    lines.push('');
    for (const ref of sourcePack.references) {
      if (ref.url) {
        lines.push(`- [${ref.citation}](${ref.url})`);
      } else {
        lines.push(`- ${ref.citation}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
