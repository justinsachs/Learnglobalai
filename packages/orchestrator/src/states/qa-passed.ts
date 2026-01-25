/**
 * QA_PASSED State Handler
 * Validates SourcePack against quality gates and generates QA report
 */

import { PipelineState, type QAReport, type SourcePack, type ModuleSpec } from '@learnglobal/contracts';
import type { RunContext, StateHandlerResult, OrchestratorDependencies } from '../types.js';
import { hashObject } from '../utils/hash.js';

export async function handleQAPassed(
  context: RunContext,
  deps: OrchestratorDependencies
): Promise<StateHandlerResult> {
  deps.logger.info('Processing QA_PASSED state - validating SourcePack', {
    runId: context.runId,
    moduleId: context.moduleId,
  });

  try {
    const spec = context.moduleSpec;
    const sourcePack = context.sourcePack!;

    // Get vertical configuration for QA thresholds
    const verticalConfig = await deps.getVerticalConfig(spec.vertical);

    // Run comprehensive QA validation
    const qaReport = runQAValidation(spec, sourcePack, verticalConfig.qualityGates);

    // Store QA report to content repository
    const qaReportJson = JSON.stringify(qaReport, null, 2);
    const qaReportHash = hashObject(qaReport);
    const storageKey = `${spec.vertical}/${spec.moduleId}/${spec.version}/${context.runId}/qa-report.json`;

    const { uri } = await deps.contentRepo.putObject(storageKey, qaReportJson, 'application/json');

    deps.logger.info('QA report generated', {
      runId: context.runId,
      uri,
      passed: qaReport.passed,
      totalChecks: qaReport.summary.totalChecks,
      failedChecks: qaReport.summary.failedChecks,
      warnings: qaReport.summary.warningCount,
    });

    // Log audit event
    await deps.logAuditEvent({
      runId: context.runId,
      moduleId: context.moduleId,
      eventType: qaReport.passed ? 'qa_passed' : 'qa_failed',
      actor: 'orchestrator',
      details: {
        passed: qaReport.passed,
        summary: qaReport.summary,
        failureReasons: qaReport.failureReasons,
        uri,
        hash: qaReportHash,
      },
    });

    // If QA fails, transition to FAILED state
    if (!qaReport.passed) {
      return {
        success: false,
        nextState: PipelineState.FAILED,
        artifacts: { qaReport },
        error: {
          code: 'QA_VALIDATION_FAILED',
          message: `QA validation failed: ${qaReport.failureReasons.join('; ')}`,
          recoverable: true,
          retryable: true,
          suggestedAction: 'Review QA report and regenerate SourcePack',
          context: {
            failures: qaReport.failures,
            recommendations: qaReport.recommendations,
          },
        },
      };
    }

    // Determine next state based on configuration
    let nextState: PipelineState;
    if (context.config.skipNotebookLm !== true && deps.notebookLm) {
      nextState = PipelineState.NOTEBOOK_CREATED;
    } else {
      nextState = PipelineState.MEDIA_PROMPT_PACK_GENERATED;
    }

    return {
      success: true,
      nextState,
      artifacts: { qaReport },
      checkpoint: {
        state: PipelineState.QA_PASSED,
        timestamp: new Date().toISOString(),
        artifactHashes: {
          ...context.checkpoint?.artifactHashes,
          qaReport: qaReportHash,
        },
        externalState: {},
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.logger.error('QA_PASSED failed', { runId: context.runId, error: message });

    return {
      success: false,
      error: {
        code: 'QA_VALIDATION_ERROR',
        message,
        recoverable: true,
        retryable: true,
      },
    };
  }
}

/**
 * Run comprehensive QA validation on SourcePack
 */
function runQAValidation(
  spec: ModuleSpec,
  sourcePack: SourcePack,
  qualityGates: {
    minTotalWords: number;
    minWordsPerHeading: number;
    maxBulletRatio: number;
    requireDisclaimers: boolean;
  }
): QAReport {
  const failures: QAReport['failures'] = [];
  const warnings: QAReport['warnings'] = [];
  const sectionWordCounts: QAReport['wordCounts']['perSection'] = [];

  // 1. Word count validation
  let totalWords = 0;
  const validateSectionWords = (sections: SourcePack['sections'], level: number = 1): void => {
    for (const section of sections) {
      totalWords += section.wordCount;

      const isMajorHeading = level <= 2;
      const meetsMinimum = !isMajorHeading || section.wordCount >= qualityGates.minWordsPerHeading;

      sectionWordCounts.push({
        sectionId: section.id,
        heading: section.heading,
        wordCount: section.wordCount,
        meetsMinimum,
        requiredMinimum: isMajorHeading ? qualityGates.minWordsPerHeading : 0,
      });

      if (isMajorHeading && !meetsMinimum) {
        failures.push({
          category: 'word_count',
          severity: 'error',
          message: `Section "${section.heading}" has ${section.wordCount} words, minimum is ${qualityGates.minWordsPerHeading}`,
          details: { sectionId: section.id, wordCount: section.wordCount },
          suggestedFix: 'Expand the section with more detailed prose content',
        });
      }

      if (section.children) {
        validateSectionWords(section.children, level + 1);
      }
    }
  };
  validateSectionWords(sourcePack.sections);

  const totalMeetsMinimum = totalWords >= qualityGates.minTotalWords;
  if (!totalMeetsMinimum) {
    failures.push({
      category: 'word_count',
      severity: 'error',
      message: `Total word count (${totalWords}) is below minimum (${qualityGates.minTotalWords})`,
      details: { totalWords, required: qualityGates.minTotalWords },
      suggestedFix: 'Add more comprehensive prose content to all sections',
    });
  }

  // 2. Bullet ratio validation
  const formattingAnalysis = analyzeFormatting(sourcePack);
  if (!formattingAnalysis.bulletRatioAcceptable) {
    failures.push({
      category: 'bullet_ratio',
      severity: 'error',
      message: `Bullet ratio (${(formattingAnalysis.bulletRatio * 100).toFixed(1)}%) exceeds maximum (${qualityGates.maxBulletRatio * 100}%)`,
      details: formattingAnalysis,
      suggestedFix: 'Convert bullet points to prose paragraphs',
    });
  }

  // 3. Artifact validation
  const artifactValidation = validateArtifacts(spec, sourcePack);
  for (const artifact of artifactValidation) {
    if (!artifact.passed) {
      if (!artifact.found) {
        failures.push({
          category: 'missing_artifact',
          severity: 'error',
          message: `Required artifact "${artifact.artifactId}" (${artifact.type}) not found`,
          details: { artifactId: artifact.artifactId, type: artifact.type },
          suggestedFix: 'Ensure the artifact is included in the appropriate section',
        });
      } else {
        for (const criterion of artifact.criteriaResults.filter((c) => !c.passed)) {
          warnings.push({
            category: 'missing_artifact',
            severity: 'warning',
            message: `Artifact "${artifact.artifactId}" failed criterion: ${criterion.criterion}`,
            details: { artifactId: artifact.artifactId, criterion: criterion.criterion },
          });
        }
      }
    }
  }

  // 4. Standards coverage validation
  const standardsCoverage = validateStandardsCoverage(spec, sourcePack);
  for (const coverage of standardsCoverage) {
    if (!coverage.covered && !coverage.markedNotApplicable) {
      failures.push({
        category: 'missing_standard',
        severity: 'error',
        message: `Standard "${coverage.standardName}" (${coverage.sectionRef}) is not covered`,
        details: { standardName: coverage.standardName, sectionRef: coverage.sectionRef },
        suggestedFix: 'Add content addressing this standard or mark as not applicable',
      });
    }
  }

  // 5. Disclaimer validation
  const disclaimerValidation = validateDisclaimers(spec, sourcePack);
  if (qualityGates.requireDisclaimers) {
    for (const disclaimer of disclaimerValidation) {
      if (!disclaimer.found) {
        failures.push({
          category: 'missing_disclaimer',
          severity: 'error',
          message: `Required disclaimer not found: "${disclaimer.requiredDisclaimer.substring(0, 50)}..."`,
          details: { disclaimer: disclaimer.requiredDisclaimer },
          suggestedFix: 'Include the required disclaimer in the disclaimers section',
        });
      }
    }
  }

  // 6. Scope boundary validation
  const scopeValidation = validateScopeBoundaries(spec, sourcePack);
  if (!scopeValidation.scopeStatementFound) {
    warnings.push({
      category: 'scope_boundary',
      severity: 'warning',
      message: 'Scope of advice statement not clearly found in content',
      suggestedFix: 'Add a clear statement about the scope and limitations of the training',
    });
  }
  if (scopeValidation.prohibitedTopicViolations.length > 0) {
    for (const violation of scopeValidation.prohibitedTopicViolations) {
      failures.push({
        category: 'scope_boundary',
        severity: 'error',
        message: `Prohibited topic detected: "${violation}"`,
        details: { topic: violation },
        suggestedFix: 'Remove or rephrase content to avoid prohibited topics',
      });
    }
  }

  // Build summary
  const totalChecks = sectionWordCounts.length + artifactValidation.length + standardsCoverage.length + disclaimerValidation.length + 3;
  const passedChecks = totalChecks - failures.length;

  const passed = failures.length === 0;

  return {
    moduleId: spec.moduleId,
    version: spec.version,
    generatedAt: new Date().toISOString(),
    runId: sourcePack.runId,
    sourcePackHash: hashObject(sourcePack),
    moduleSpecHash: hashObject(spec),
    wordCounts: {
      perSection: sectionWordCounts,
      total: totalWords,
      requiredMinimum: qualityGates.minTotalWords,
      totalMeetsMinimum,
    },
    formatting: {
      ...formattingAnalysis,
      bulletRatioThreshold: qualityGates.maxBulletRatio,
    },
    artifactValidation,
    standardsCoverage,
    disclaimerValidation,
    scopeBoundaryValidation: scopeValidation,
    failures,
    warnings,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks: failures.length,
      warningCount: warnings.length,
    },
    passed,
    failureReasons: failures.map((f) => f.message),
    recommendations: generateRecommendations(failures, warnings),
  };
}

function analyzeFormatting(sourcePack: SourcePack): QAReport['formatting'] {
  let totalLines = 0;
  let bulletLines = 0;
  let numberedLines = 0;

  const analyze = (sections: SourcePack['sections']): void => {
    for (const section of sections) {
      const lines = section.fullProseText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        totalLines++;
        if (/^[-*•]/.test(trimmed)) bulletLines++;
        if (/^\d+[.)]\s/.test(trimmed)) numberedLines++;
      }
      if (section.children) analyze(section.children);
    }
  };
  analyze(sourcePack.sections);

  const bulletRatio = totalLines > 0 ? (bulletLines + numberedLines) / totalLines : 0;

  return {
    totalLines,
    bulletLines,
    numberedLines,
    bulletRatio,
    bulletRatioAcceptable: bulletRatio <= 0.08,
    bulletRatioThreshold: 0.08,
    forbiddenFormattingViolations: [],
  };
}

function validateArtifacts(spec: ModuleSpec, sourcePack: SourcePack): QAReport['artifactValidation'] {
  const results: QAReport['artifactValidation'] = [];

  for (const required of spec.requiredArtifacts) {
    let found = false;
    let foundInSection: string | undefined;

    const search = (sections: SourcePack['sections']): boolean => {
      for (const section of sections) {
        const allArtifacts = [
          ...(section.embeddedChecklists || []),
          ...(section.embeddedForms || []),
          ...(section.embeddedArtifacts || []),
        ];
        for (const artifact of allArtifacts) {
          if (artifact.artifactId === required.id) {
            found = true;
            foundInSection = section.id;
            return true;
          }
        }
        if (section.children && search(section.children)) return true;
      }
      return false;
    };
    search(sourcePack.sections);

    results.push({
      artifactId: required.id,
      type: required.type,
      found,
      foundInSection,
      criteriaResults: required.passCriteria.map((criterion) => ({
        criterion,
        passed: found, // Simplified - actual implementation would check specific criteria
      })),
      passed: found,
    });
  }

  return results;
}

function validateStandardsCoverage(spec: ModuleSpec, sourcePack: SourcePack): QAReport['standardsCoverage'] {
  const results: QAReport['standardsCoverage'] = [];
  const fullText = JSON.stringify(sourcePack).toLowerCase();

  for (const standard of spec.standardsMap) {
    const searchTerm = `${standard.standardName} ${standard.sectionRef}`.toLowerCase();
    const covered = fullText.includes(standard.standardName.toLowerCase()) ||
                   fullText.includes(standard.sectionRef.toLowerCase());

    const addressedInSections: string[] = [];
    const findSections = (sections: SourcePack['sections']): void => {
      for (const section of sections) {
        for (const trace of section.traceability) {
          if (trace.standardName === standard.standardName && trace.sectionRef === standard.sectionRef) {
            addressedInSections.push(section.id);
          }
        }
        if (section.children) findSections(section.children);
      }
    };
    findSections(sourcePack.sections);

    results.push({
      standardName: standard.standardName,
      sectionRef: standard.sectionRef,
      covered: covered || addressedInSections.length > 0,
      markedNotApplicable: false,
      addressedInSections,
      coverageQuality: addressedInSections.length > 0 ? 'adequate' : covered ? 'minimal' : undefined,
    });
  }

  return results;
}

function validateDisclaimers(spec: ModuleSpec, sourcePack: SourcePack): QAReport['disclaimerValidation'] {
  const results: QAReport['disclaimerValidation'] = [];

  for (const required of spec.constraints.requiredDisclaimers) {
    const found = sourcePack.disclaimers.some((d) =>
      d.toLowerCase().includes(required.toLowerCase().substring(0, 30))
    );

    results.push({
      requiredDisclaimer: required,
      found,
      location: found ? 'disclaimers' : undefined,
    });
  }

  return results;
}

function validateScopeBoundaries(spec: ModuleSpec, sourcePack: SourcePack): QAReport['scopeBoundaryValidation'] {
  const fullText = JSON.stringify(sourcePack).toLowerCase();

  const scopeStatementFound = fullText.includes('scope') ||
                             fullText.includes('limitation') ||
                             fullText.includes('this training');

  const escalationTriggersMentioned = spec.safetyBoundaries.escalationTriggers.some((trigger) =>
    fullText.includes(trigger.toLowerCase())
  );

  const prohibitedTopicViolations: string[] = [];
  for (const topic of spec.safetyBoundaries.prohibitedTopics || []) {
    if (fullText.includes(topic.toLowerCase())) {
      prohibitedTopicViolations.push(topic);
    }
  }

  return {
    scopeStatementFound,
    escalationTriggersMentioned,
    prohibitedTopicViolations,
    sensitiveTopicsHandled: true,
  };
}

function generateRecommendations(failures: QAReport['failures'], warnings: QAReport['warnings']): string[] {
  const recommendations: string[] = [];

  if (failures.some((f) => f.category === 'word_count')) {
    recommendations.push('Expand content with more detailed explanations, examples, and context');
  }

  if (failures.some((f) => f.category === 'bullet_ratio')) {
    recommendations.push('Convert bullet-point lists into flowing prose paragraphs');
  }

  if (failures.some((f) => f.category === 'missing_artifact')) {
    recommendations.push('Ensure all required artifacts (checklists, forms, scenarios) are included');
  }

  if (failures.some((f) => f.category === 'missing_standard')) {
    recommendations.push('Add explicit references to regulatory standards and requirements');
  }

  if (warnings.length > 0) {
    recommendations.push('Review warnings and address non-critical issues for improved quality');
  }

  return recommendations;
}
