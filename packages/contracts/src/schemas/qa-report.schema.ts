/**
 * Zod schemas for QA Report validation
 */

import { z } from 'zod';

/**
 * Section word count schema
 */
export const SectionWordCountSchema = z.object({
  sectionId: z.string().min(1),
  heading: z.string().min(1),
  wordCount: z.number().int().min(0),
  meetsMinimum: z.boolean(),
  requiredMinimum: z.number().int().min(0),
});

/**
 * Artifact validation schema
 */
export const ArtifactValidationSchema = z.object({
  artifactId: z.string().min(1),
  type: z.string().min(1),
  found: z.boolean(),
  foundInSection: z.string().optional(),
  criteriaResults: z.array(z.object({
    criterion: z.string().min(1),
    passed: z.boolean(),
    notes: z.string().optional(),
  })),
  passed: z.boolean(),
});

/**
 * Standards coverage schema
 */
export const StandardsCoverageSchema = z.object({
  standardName: z.string().min(1),
  sectionRef: z.string().min(1),
  covered: z.boolean(),
  markedNotApplicable: z.boolean(),
  addressedInSections: z.array(z.string()),
  coverageQuality: z.enum(['minimal', 'adequate', 'thorough']).optional(),
});

/**
 * Formatting analysis schema
 */
export const FormattingAnalysisSchema = z.object({
  totalLines: z.number().int().min(0),
  bulletLines: z.number().int().min(0),
  numberedLines: z.number().int().min(0),
  bulletRatio: z.number().min(0).max(1),
  bulletRatioAcceptable: z.boolean(),
  bulletRatioThreshold: z.number().min(0).max(1),
  forbiddenFormattingViolations: z.array(z.object({
    rule: z.string().min(1),
    occurrences: z.number().int().min(0),
    examples: z.array(z.string()),
  })),
});

/**
 * Disclaimer validation schema
 */
export const DisclaimerValidationSchema = z.object({
  requiredDisclaimer: z.string().min(1),
  found: z.boolean(),
  location: z.string().optional(),
});

/**
 * Scope boundary validation schema
 */
export const ScopeBoundaryValidationSchema = z.object({
  scopeStatementFound: z.boolean(),
  escalationTriggersMentioned: z.boolean(),
  prohibitedTopicViolations: z.array(z.string()),
  sensitiveTopicsHandled: z.boolean(),
});

/**
 * Validation failure schema
 */
export const ValidationFailureSchema = z.object({
  category: z.enum([
    'word_count',
    'bullet_ratio',
    'missing_artifact',
    'missing_standard',
    'missing_disclaimer',
    'formatting',
    'scope_boundary',
    'other',
  ]),
  severity: z.enum(['error', 'warning']),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  suggestedFix: z.string().optional(),
});

/**
 * Complete QA Report schema
 */
export const QAReportSchema = z.object({
  moduleId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  generatedAt: z.string().datetime(),
  runId: z.string().min(1),
  sourcePackHash: z.string().min(1),
  moduleSpecHash: z.string().min(1),
  wordCounts: z.object({
    perSection: z.array(SectionWordCountSchema),
    total: z.number().int().min(0),
    requiredMinimum: z.number().int().min(0),
    totalMeetsMinimum: z.boolean(),
  }),
  formatting: FormattingAnalysisSchema,
  artifactValidation: z.array(ArtifactValidationSchema),
  standardsCoverage: z.array(StandardsCoverageSchema),
  disclaimerValidation: z.array(DisclaimerValidationSchema),
  scopeBoundaryValidation: ScopeBoundaryValidationSchema,
  failures: z.array(ValidationFailureSchema),
  warnings: z.array(ValidationFailureSchema),
  summary: z.object({
    totalChecks: z.number().int().min(0),
    passedChecks: z.number().int().min(0),
    failedChecks: z.number().int().min(0),
    warningCount: z.number().int().min(0),
  }),
  passed: z.boolean(),
  failureReasons: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
});

/**
 * QA Config schema
 */
export const QAConfigSchema = z.object({
  minWordsPerMajorHeading: z.number().int().min(0),
  minTotalWords: z.number().int().min(0),
  maxBulletRatio: z.number().min(0).max(1),
  requireDisclaimers: z.boolean(),
  requireAllArtifacts: z.boolean(),
  requireAllStandardsCovered: z.boolean(),
  allowNotApplicableStandards: z.boolean(),
  strictMode: z.boolean(),
});

// Type exports
export type SectionWordCountInput = z.infer<typeof SectionWordCountSchema>;
export type ArtifactValidationInput = z.infer<typeof ArtifactValidationSchema>;
export type StandardsCoverageInput = z.infer<typeof StandardsCoverageSchema>;
export type ValidationFailureInput = z.infer<typeof ValidationFailureSchema>;
export type QAReportInput = z.infer<typeof QAReportSchema>;
export type QAConfigInput = z.infer<typeof QAConfigSchema>;
