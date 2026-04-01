/**
 * AUDIT_FINALIZED State Handler
 * Finalizes the run with complete asset manifest and audit trail
 */

import { PipelineState, type AssetManifest } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleAuditFinalized(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing AUDIT_FINALIZED state - creating asset manifest', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  try {
    const spec = context.moduleSpec;
    const startTime = new Date(context.startedAt).getTime();
    const endTime = Date.now();
    const totalDurationMs = endTime - startTime;

    // Load audit entries from storage
    const auditEntries = await deps.getAuditEntries(context.runId);

    // Generate and store markdown version for size/hash calculation
    const sourcePackMarkdown = context.sourcePack ? generateSourcePackMarkdown(context.sourcePack) : '';
    const markdownHash = sourcePackMarkdown ? hashObject(sourcePackMarkdown) : '';

    // Build complete asset manifest
    const assetManifest: AssetManifest = {
      moduleId: spec.moduleId,
      runId: context.runId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      finalState: PipelineState.AUDIT_FINALIZED,
      successful: true,

      contentRepo: {
        moduleSpec: {
          type: 'module_spec',
          uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/module-spec.json`,
          contentType: 'application/json',
          sizeBytes: JSON.stringify(spec).length,
          hash: {
            algorithm: 'sha256',
            hash: hashObject(spec),
            computedAt: new Date().toISOString(),
          },
          generatedAt: context.startedAt,
          version: spec.version,
        },
        outline: {
          type: 'outline',
          uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/outline.json`,
          contentType: 'application/json',
          sizeBytes: JSON.stringify(context.outline).length,
          hash: {
            algorithm: 'sha256',
            hash: context.outline ? hashObject(context.outline) : '',
            computedAt: new Date().toISOString(),
          },
          generatedAt: new Date().toISOString(),
          version: spec.version,
        },
        sourcePackJson: {
          type: 'sourcepack_json',
          uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/sourcepack.json`,
          contentType: 'application/json',
          sizeBytes: JSON.stringify(context.sourcePack).length,
          hash: {
            algorithm: 'sha256',
            hash: context.sourcePack ? hashObject(context.sourcePack) : '',
            computedAt: new Date().toISOString(),
          },
          generatedAt: new Date().toISOString(),
          version: spec.version,
        },
        sourcePackMarkdown: {
          type: 'sourcepack_markdown',
          uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/sourcepack.md`,
          contentType: 'text/markdown',
          sizeBytes: Buffer.byteLength(sourcePackMarkdown, 'utf8'),
          hash: {
            algorithm: 'sha256',
            hash: markdownHash,
            computedAt: new Date().toISOString(),
          },
          generatedAt: new Date().toISOString(),
          version: spec.version,
        },
        qaReport: {
          type: 'qa_report',
          uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/qa-report.json`,
          contentType: 'application/json',
          sizeBytes: JSON.stringify(context.qaReport).length,
          hash: {
            algorithm: 'sha256',
            hash: context.qaReport ? hashObject(context.qaReport) : '',
            computedAt: new Date().toISOString(),
          },
          generatedAt: new Date().toISOString(),
          version: spec.version,
        },
        ...(context.mediaPromptPack && {
          mediaPromptPack: {
            type: 'media_prompt_pack_json',
            uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/media-prompt-pack.json`,
            contentType: 'application/json',
            sizeBytes: JSON.stringify(context.mediaPromptPack).length,
            hash: {
              algorithm: 'sha256',
              hash: hashObject(context.mediaPromptPack),
              computedAt: new Date().toISOString(),
            },
            generatedAt: new Date().toISOString(),
            version: spec.version,
          },
        }),
        ...(context.heygenPackage && {
          heygenPackage: {
            type: 'heygen_package',
            uri: `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/heygen-package.json`,
            contentType: 'application/json',
            sizeBytes: JSON.stringify(context.heygenPackage).length,
            hash: {
              algorithm: 'sha256',
              hash: hashObject(context.heygenPackage),
              computedAt: new Date().toISOString(),
            },
            generatedAt: new Date().toISOString(),
            version: spec.version,
          },
        }),
      },

      notebookLm: {
        enabled: !!context.notebookLmState?.notebookId,
        ...(context.notebookLmState && {
          notebookId: context.notebookLmState.notebookId,
          sourceIds: context.notebookLmState.sourceIds,
          promptDocId: context.notebookLmState.promptDocId,
          shareUrl: context.notebookLmState.shareUrl,
          createdAt: context.notebookLmState.createdAt,
          lastSyncedAt: context.notebookLmState.lastSyncedAt,
        }),
      },

      heygen: {
        enabled: !!context.heygenState?.jobId,
        ...(context.heygenState && {
          renderJobId: context.heygenState.jobId,
          status: context.heygenState.status,
          videoUrl: context.heygenState.videoUrl,
          requestedAt: context.heygenState.requestedAt,
          completedAt: context.heygenState.completedAt,
          error: context.heygenState.error,
        }),
      },

      lms: {
        enabled: !!context.lmsState?.modulePageId,
        provider: 'filesystem', // or configured provider
        ...(context.lmsState && {
          modulePageId: context.lmsState.modulePageId,
          moduleUrl: context.lmsState.moduleUrl,
          assetPlacementMap: context.lmsState.assetIds.map((id, i) => ({
            assetId: id,
            assetType: i === 0 ? 'document' : 'video',
            placement: i === 0 ? 'main-content' : 'video-content',
            order: i + 1,
          })) as AssetManifest['lms']['assetPlacementMap'],
          status: context.lmsState.status,
          publishedAt: context.lmsState.publishedAt,
          publishedBy: context.lmsState.publishedBy,
        }),
      },

      chat: {
        enabled: !!context.chatState?.configId,
        ...(context.chatState && {
          configId: context.chatState.configId,
          retrievalIndexId: context.chatState.retrievalIndexId,
          policyId: context.chatState.policyId,
          configuredAt: context.chatState.configuredAt,
          sourcesIndexed: context.chatState.sourcesIndexed,
        }),
      },

      audit: {
        entries: auditEntries.map(e => ({
          timestamp: e.timestamp,
          eventType: e.eventType,
          actor: e.actor,
          fromState: e.fromState,
          toState: e.toState,
          details: e.details,
        })),
        hashes: {
          moduleSpec: {
            algorithm: 'sha256',
            hash: hashObject(spec),
            computedAt: new Date().toISOString(),
          },
          ...(context.outline && {
            outline: {
              algorithm: 'sha256',
              hash: hashObject(context.outline),
              computedAt: new Date().toISOString(),
            },
          }),
          ...(context.sourcePack && {
            sourcePack: {
              algorithm: 'sha256',
              hash: hashObject(context.sourcePack),
              computedAt: new Date().toISOString(),
            },
          }),
          ...(context.qaReport && {
            qaReport: {
              algorithm: 'sha256',
              hash: hashObject(context.qaReport),
              computedAt: new Date().toISOString(),
            },
          }),
        },
        approvals: [],
        totalDurationMs,
        startedAt: context.startedAt,
        completedAt: new Date().toISOString(),
      },

      metadata: {
        vertical: spec.vertical,
        pipelineVersion: '1.0.0',
        environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
        tags: spec.tags,
      },
    };

    // Store asset manifest
    const manifestJson = JSON.stringify(assetManifest, null, 2);
    const manifestHash = hashObject(assetManifest);
    const storageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/asset-manifest.json`;

    const { uri } = await deps.contentRepo.putObject(storageKey, manifestJson, 'application/json');

    deps.logger.info('Asset manifest created and stored', {
      runId: context.runId,
      uri,
      hash: manifestHash,
      totalDurationMs,
    });

    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: 'run_completed',
      actor: 'orchestrator',
      details: {
        manifestUri: uri,
        manifestHash,
        totalDurationMs,
        finalState: PipelineState.AUDIT_FINALIZED,
      },
    });

    return {
      success: true,
      // AUDIT_FINALIZED is terminal, no next state
      artifacts: {
        assetManifest,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('AUDIT_FINALIZED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'AUDIT_FINALIZE_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}

/**
 * Generate markdown from sourcepack for storage and hashing
 */
function generateSourcePackMarkdown(sourcePack: import('@learnglobal/contracts').SourcePack): string {
  const lines: string[] = [];

  lines.push(`# ${sourcePack.title}`);
  lines.push('');
  lines.push(`**Version:** ${sourcePack.version}`);
  lines.push(`**Generated:** ${sourcePack.generatedAt}`);
  lines.push('');

  // Generate sections recursively
  const generateSection = (section: typeof sourcePack.sections[0], level: number): void => {
    const heading = '#'.repeat(Math.min(level + 1, 6));
    lines.push(`${heading} ${section.heading}`);
    lines.push('');
    lines.push(section.fullProseText);
    lines.push('');

    // Add traceability
    if (section.traceability.length > 0) {
      lines.push('**Standards Referenced:**');
      for (const trace of section.traceability) {
        lines.push(`- ${trace.standardName} (${trace.sectionRef})`);
      }
      lines.push('');
    }

    // Add embedded scenarios
    if (section.embeddedScenarios) {
      for (const scenario of section.embeddedScenarios) {
        lines.push(`#### Scenario: ${scenario.title}`);
        lines.push('');
        lines.push(scenario.content);
        lines.push('');
        if (scenario.dialogue) {
          lines.push('**Dialogue:**');
          for (const line of scenario.dialogue) {
            lines.push(`> **${line.speaker}:** ${line.text}`);
          }
          lines.push('');
        }
      }
    }

    // Add embedded checklists
    if (section.embeddedChecklists) {
      for (const checklist of section.embeddedChecklists) {
        lines.push(`#### Checklist: ${checklist.title}`);
        lines.push('');
        for (const item of checklist.items) {
          lines.push(`- [ ] ${item.text}${item.note ? ` _(${item.note})_` : ''}`);
        }
        lines.push('');
      }
    }

    // Process children
    if (section.children) {
      for (const child of section.children) {
        generateSection(child, level + 1);
      }
    }
  };

  for (const section of sourcePack.sections) {
    generateSection(section, 1);
  }

  // Add glossary
  if (sourcePack.glossary && sourcePack.glossary.length > 0) {
    lines.push('## Glossary');
    lines.push('');
    for (const term of sourcePack.glossary) {
      lines.push(`**${term.term}:** ${term.definition}`);
    }
    lines.push('');
  }

  // Add references
  if (sourcePack.references && sourcePack.references.length > 0) {
    lines.push('## References');
    lines.push('');
    for (const ref of sourcePack.references) {
      lines.push(`- ${ref.citation}${ref.url ? ` [Link](${ref.url})` : ''}`);
    }
    lines.push('');
  }

  // Add disclaimers
  if (sourcePack.disclaimers && sourcePack.disclaimers.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('**Disclaimers:**');
    lines.push('');
    for (const disclaimer of sourcePack.disclaimers) {
      lines.push(`_${disclaimer}_`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
