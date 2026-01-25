/**
 * QA Validation Agent
 *
 * Specialized agent for validating generated content against
 * quality requirements and specifications.
 */

import type { ModuleSpec, SourcePack, QAReport } from '@learnglobal/contracts';
import type { TokenUsage } from '../types.js';
import { BaseAgent, AgentContext, AgentConfig } from './base.js';

export interface QAAgentInput {
  spec: ModuleSpec;
  sourcePack: SourcePack;
}

export interface QAAgentOutput {
  qaReport: QAReport;
}

/**
 * Agent that validates content quality and compliance
 */
export class QAAgent extends BaseAgent<QAAgentInput, QAAgentOutput> {
  get name(): string {
    return 'qa-agent';
  }

  get description(): string {
    return 'Validates generated content against quality requirements and specifications';
  }

  constructor(llmProvider: import('../types.js').LLMProvider, config?: Partial<AgentConfig>) {
    super(llmProvider, {
      temperature: 0.3, // Lower temperature for consistent validation
      maxTokens: 4096,
      ...config,
    });
  }

  protected async run(
    input: QAAgentInput,
    context: AgentContext
  ): Promise<{ data: QAAgentOutput; usage: TokenUsage }> {
    const { spec, sourcePack } = input;

    this.trace('validate_content', { moduleId: spec.moduleId });

    // Run validation checks
    const wordCounts = this.validateWordCounts(spec, sourcePack);
    const formatting = this.validateFormatting(spec, sourcePack);
    const artifactValidation = this.validateArtifacts(spec, sourcePack);
    const standardsCoverage = this.validateStandardsCoverage(spec, sourcePack);
    const disclaimerValidation = this.validateDisclaimers(spec, sourcePack);
    const scopeBoundaryValidation = this.validateScopeBoundaries(spec, sourcePack);

    // Collect failures and warnings
    const failures: QAReport['failures'] = [];
    const warnings: QAReport['warnings'] = [];

    // Word count failures
    if (!wordCounts.totalMeetsMinimum) {
      failures.push({
        code: 'WORD_COUNT_TOTAL',
        severity: 'error',
        message: `Total word count ${wordCounts.total} is below minimum ${wordCounts.requiredMinimum}`,
        location: 'document',
      });
    }

    for (const section of wordCounts.perSection) {
      if (!section.meetsMinimum) {
        warnings.push({
          code: 'WORD_COUNT_SECTION',
          severity: 'warning',
          message: `Section "${section.sectionId}" has ${section.actualCount} words, below minimum ${section.minimumRequired}`,
          location: section.sectionId,
        });
      }
    }

    // Formatting failures
    if (!formatting.bulletRatioAcceptable) {
      failures.push({
        code: 'BULLET_RATIO',
        severity: 'error',
        message: `Bullet ratio ${formatting.bulletRatio.toFixed(2)} exceeds maximum ${formatting.bulletRatioThreshold}`,
        location: 'document',
      });
    }

    for (const violation of formatting.forbiddenFormattingViolations) {
      warnings.push({
        code: 'FORBIDDEN_FORMATTING',
        severity: 'warning',
        message: violation.description,
        location: violation.location,
      });
    }

    // Artifact failures
    for (const artifact of artifactValidation) {
      if (!artifact.found) {
        failures.push({
          code: 'MISSING_ARTIFACT',
          severity: 'error',
          message: `Required artifact "${artifact.artifactId}" (${artifact.artifactType}) not found`,
          location: 'document',
        });
      }
    }

    // Standards coverage failures
    for (const standard of standardsCoverage) {
      if (!standard.covered) {
        failures.push({
          code: 'MISSING_STANDARD',
          severity: 'error',
          message: `Standard "${standard.standardId}" is not covered in content`,
          location: 'document',
        });
      }
    }

    // Disclaimer failures
    for (const disclaimer of disclaimerValidation) {
      if (!disclaimer.found) {
        failures.push({
          code: 'MISSING_DISCLAIMER',
          severity: 'error',
          message: `Required disclaimer not found: "${disclaimer.requiredText.substring(0, 50)}..."`,
          location: 'document',
        });
      }
    }

    // Scope boundary failures
    for (const violation of scopeBoundaryValidation.prohibitedTopicViolations) {
      failures.push({
        code: 'PROHIBITED_TOPIC',
        severity: 'error',
        message: `Prohibited topic "${violation.topic}" found at: ${violation.location}`,
        location: violation.location,
      });
    }

    // Calculate summary
    const totalChecks =
      1 + // word count total
      wordCounts.perSection.length +
      1 + // bullet ratio
      artifactValidation.length +
      standardsCoverage.length +
      disclaimerValidation.length +
      3; // scope boundary checks

    const failedChecks = failures.length;
    const passedChecks = totalChecks - failedChecks;

    const qaReport: QAReport = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: context.runId,
      sourcePackHash: this.hashObject(sourcePack),
      moduleSpecHash: this.hashObject(spec),
      wordCounts,
      formatting,
      artifactValidation,
      standardsCoverage,
      disclaimerValidation,
      scopeBoundaryValidation,
      failures,
      warnings,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        warningCount: warnings.length,
      },
      passed: failures.length === 0,
      failureReasons: failures.map(f => f.message),
    };

    this.trace('validation_complete', {
      passed: qaReport.passed,
      failures: failures.length,
      warnings: warnings.length,
    });

    return {
      data: { qaReport },
      usage: { prompt: 0, completion: 0, total: 0 }, // Rule-based validation, no LLM usage
    };
  }

  private validateWordCounts(spec: ModuleSpec, sourcePack: SourcePack): QAReport['wordCounts'] {
    const perSection: QAReport['wordCounts']['perSection'] = [];

    const processSection = (section: SourcePack['sections'][0], isTopLevel: boolean): void => {
      const minimumRequired = isTopLevel ? spec.constraints.minWordsPerMajorHeading : 200;
      perSection.push({
        sectionId: section.id,
        actualCount: section.wordCount,
        minimumRequired,
        meetsMinimum: section.wordCount >= minimumRequired,
      });

      if (section.children) {
        for (const child of section.children) {
          processSection(child, false);
        }
      }
    };

    for (const section of sourcePack.sections) {
      processSection(section, true);
    }

    return {
      perSection,
      total: sourcePack.totalWordCount,
      requiredMinimum: spec.constraints.minTotalWords,
      totalMeetsMinimum: sourcePack.totalWordCount >= spec.constraints.minTotalWords,
    };
  }

  private validateFormatting(spec: ModuleSpec, sourcePack: SourcePack): QAReport['formatting'] {
    let totalLines = 0;
    let bulletLines = 0;
    let numberedLines = 0;
    const violations: Array<{ pattern: string; location: string; description: string }> = [];

    const processSection = (section: SourcePack['sections'][0]): void => {
      const lines = section.fullProseText.split('\n');
      totalLines += lines.length;

      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[-•*]\s/.test(trimmed)) {
          bulletLines++;
        }
        if (/^\d+[.)]\s/.test(trimmed)) {
          numberedLines++;
        }
      }

      if (section.children) {
        for (const child of section.children) {
          processSection(child);
        }
      }
    };

    for (const section of sourcePack.sections) {
      processSection(section);
    }

    const bulletRatio = totalLines > 0 ? (bulletLines + numberedLines) / totalLines : 0;

    return {
      totalLines,
      bulletLines,
      numberedLines,
      bulletRatio,
      bulletRatioAcceptable: bulletRatio <= spec.constraints.maxBulletRatio,
      bulletRatioThreshold: spec.constraints.maxBulletRatio,
      forbiddenFormattingViolations: violations,
    };
  }

  private validateArtifacts(spec: ModuleSpec, sourcePack: SourcePack): QAReport['artifactValidation'] {
    const results: QAReport['artifactValidation'] = [];
    const contentText = this.extractAllText(sourcePack);

    for (const artifact of spec.requiredArtifacts) {
      // Check if artifact is embedded
      let found = false;
      let locationFound: string | undefined;

      for (const section of sourcePack.sections) {
        if (this.sectionContainsArtifact(section, artifact.id)) {
          found = true;
          locationFound = section.id;
          break;
        }
      }

      // Also check by title mention
      if (!found && contentText.toLowerCase().includes(artifact.title.toLowerCase())) {
        found = true;
        locationFound = 'mentioned in content';
      }

      results.push({
        artifactId: artifact.id,
        artifactType: artifact.type,
        found,
        locationFound,
        validationErrors: found ? [] : [`Artifact "${artifact.title}" not found in content`],
      });
    }

    return results;
  }

  private sectionContainsArtifact(section: SourcePack['sections'][0], artifactId: string): boolean {
    if (section.embeddedArtifacts?.some(a => a.artifactId === artifactId)) {
      return true;
    }
    if (section.embeddedChecklists?.some(c => c.id === artifactId)) {
      return true;
    }
    if (section.embeddedForms?.some(f => f.id === artifactId)) {
      return true;
    }
    if (section.children) {
      return section.children.some(child => this.sectionContainsArtifact(child, artifactId));
    }
    return false;
  }

  private validateStandardsCoverage(spec: ModuleSpec, sourcePack: SourcePack): QAReport['standardsCoverage'] {
    const results: QAReport['standardsCoverage'] = [];
    const contentText = this.extractAllText(sourcePack);
    const traceabilities = this.extractAllTraceabilities(sourcePack);

    for (const standard of spec.standardsMap) {
      const covered =
        traceabilities.some(t => t.ref === standard.standardId) ||
        contentText.includes(standard.standardId) ||
        contentText.toLowerCase().includes(standard.title.toLowerCase());

      results.push({
        standardId: standard.standardId,
        covered,
        sectionsReferenced: traceabilities
          .filter(t => t.ref === standard.standardId)
          .map(t => t.sectionId || 'unknown'),
      });
    }

    return results;
  }

  private validateDisclaimers(spec: ModuleSpec, sourcePack: SourcePack): QAReport['disclaimerValidation'] {
    const results: QAReport['disclaimerValidation'] = [];
    const contentText = this.extractAllText(sourcePack).toLowerCase();

    for (const disclaimer of spec.safetyBoundaries.disclaimers) {
      // Check for exact match or key phrases
      const keyPhrases = disclaimer.toLowerCase().split(/[.!?]/).filter(p => p.trim().length > 10);
      const found = keyPhrases.some(phrase => contentText.includes(phrase.trim()));

      results.push({
        requiredText: disclaimer,
        found,
        locationFound: found ? 'content' : undefined,
      });
    }

    return results;
  }

  private validateScopeBoundaries(spec: ModuleSpec, sourcePack: SourcePack): QAReport['scopeBoundaryValidation'] {
    const contentText = this.extractAllText(sourcePack).toLowerCase();
    const violations: Array<{ topic: string; location: string; context: string }> = [];

    // Check for prohibited topics
    for (const topic of spec.safetyBoundaries.prohibitedTopics || []) {
      if (contentText.includes(topic.toLowerCase())) {
        const index = contentText.indexOf(topic.toLowerCase());
        const context = contentText.substring(Math.max(0, index - 50), Math.min(contentText.length, index + 50));
        violations.push({
          topic,
          location: 'content',
          context: `...${context}...`,
        });
      }
    }

    // Check for scope statement
    const scopeStatementFound =
      contentText.includes('scope') ||
      contentText.includes('this module covers') ||
      contentText.includes('this training addresses');

    // Check for escalation triggers
    const escalationTriggersMentioned = spec.safetyBoundaries.escalationTriggers.some(trigger =>
      contentText.includes(trigger.toLowerCase())
    );

    return {
      scopeStatementFound,
      escalationTriggersMentioned,
      prohibitedTopicViolations: violations,
      sensitiveTopicsHandled: violations.length === 0,
    };
  }

  private extractAllText(sourcePack: SourcePack): string {
    const texts: string[] = [sourcePack.title, sourcePack.abstract];

    const processSection = (section: SourcePack['sections'][0]): void => {
      texts.push(section.heading, section.fullProseText);
      if (section.children) {
        section.children.forEach(processSection);
      }
    };

    sourcePack.sections.forEach(processSection);
    return texts.join(' ');
  }

  private extractAllTraceabilities(sourcePack: SourcePack): Array<{ ref: string; sectionId?: string }> {
    const results: Array<{ ref: string; sectionId?: string }> = [];

    const processSection = (section: SourcePack['sections'][0]): void => {
      for (const trace of section.traceability) {
        results.push({ ref: trace.ref, sectionId: section.id });
      }
      if (section.children) {
        section.children.forEach(processSection);
      }
    };

    sourcePack.sections.forEach(processSection);
    return results;
  }

  private hashObject(obj: unknown): string {
    const { createHash } = require('crypto');
    const json = JSON.stringify(obj, Object.keys(obj as object).sort());
    return createHash('sha256').update(json).digest('hex');
  }
}
