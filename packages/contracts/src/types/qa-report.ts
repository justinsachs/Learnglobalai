/**
 * QAReport - Quality assurance validation report
 * Generated after SourcePack creation to enforce quality gates
 */

import type { ModuleId, Version, Timestamp, Hash } from './base.js';

/**
 * Word count details per section
 */
export interface SectionWordCount {
  /** Section ID */
  sectionId: string;
  /** Section heading */
  heading: string;
  /** Word count */
  wordCount: number;
  /** Whether it meets minimum requirement */
  meetsMinimum: boolean;
  /** Required minimum */
  requiredMinimum: number;
}

/**
 * Artifact validation result
 */
export interface ArtifactValidation {
  /** Artifact ID */
  artifactId: string;
  /** Artifact type */
  type: string;
  /** Whether the artifact was found */
  found: boolean;
  /** Section ID where found (if found) */
  foundInSection?: string;
  /** Pass criteria results */
  criteriaResults: Array<{
    criterion: string;
    passed: boolean;
    notes?: string;
  }>;
  /** Overall pass/fail for this artifact */
  passed: boolean;
}

/**
 * Standards coverage validation
 */
export interface StandardsCoverage {
  /** Standard name */
  standardName: string;
  /** Section reference */
  sectionRef: string;
  /** Whether it's covered in the content */
  covered: boolean;
  /** Explicitly marked as not applicable */
  markedNotApplicable: boolean;
  /** Sections where it's addressed */
  addressedInSections: string[];
  /** Coverage quality assessment */
  coverageQuality?: 'minimal' | 'adequate' | 'thorough';
}

/**
 * Formatting analysis
 */
export interface FormattingAnalysis {
  /** Total lines in content */
  totalLines: number;
  /** Lines starting with bullets */
  bulletLines: number;
  /** Lines starting with numbers */
  numberedLines: number;
  /** Bullet ratio (bulletLines / totalLines) */
  bulletRatio: number;
  /** Whether bullet ratio is acceptable */
  bulletRatioAcceptable: boolean;
  /** Threshold used */
  bulletRatioThreshold: number;
  /** Forbidden formatting violations found */
  forbiddenFormattingViolations: Array<{
    rule: string;
    occurrences: number;
    examples: string[];
  }>;
}

/**
 * Disclaimer validation
 */
export interface DisclaimerValidation {
  /** Required disclaimer */
  requiredDisclaimer: string;
  /** Whether it was found */
  found: boolean;
  /** Location where found */
  location?: string;
}

/**
 * Scope boundary validation
 */
export interface ScopeBoundaryValidation {
  /** Scope statement found */
  scopeStatementFound: boolean;
  /** Escalation triggers mentioned */
  escalationTriggersMentioned: boolean;
  /** Prohibited topics violations */
  prohibitedTopicViolations: string[];
  /** Sensitive topics properly handled */
  sensitiveTopicsHandled: boolean;
}

/**
 * Individual validation failure
 */
export interface ValidationFailure {
  /** Failure category */
  category:
    | 'word_count'
    | 'bullet_ratio'
    | 'missing_artifact'
    | 'missing_standard'
    | 'missing_disclaimer'
    | 'formatting'
    | 'scope_boundary'
    | 'other';
  /** Failure severity */
  severity: 'error' | 'warning';
  /** Human-readable message */
  message: string;
  /** Details about the failure */
  details?: Record<string, unknown>;
  /** Suggested fix */
  suggestedFix?: string;
}

/**
 * Complete QA Report
 */
export interface QAReport {
  /** Module ID */
  moduleId: ModuleId;

  /** Version */
  version: Version;

  /** Generation timestamp */
  generatedAt: Timestamp;

  /** Run ID */
  runId: string;

  /** SourcePack being validated */
  sourcePackHash: Hash;

  /** ModuleSpec hash */
  moduleSpecHash: Hash;

  /** Word count analysis */
  wordCounts: {
    /** Per-section breakdown */
    perSection: SectionWordCount[];
    /** Total word count */
    total: number;
    /** Required minimum */
    requiredMinimum: number;
    /** Whether total meets minimum */
    totalMeetsMinimum: boolean;
  };

  /** Formatting analysis */
  formatting: FormattingAnalysis;

  /** Artifact validation results */
  artifactValidation: ArtifactValidation[];

  /** Standards coverage results */
  standardsCoverage: StandardsCoverage[];

  /** Disclaimer validation */
  disclaimerValidation: DisclaimerValidation[];

  /** Scope boundary validation */
  scopeBoundaryValidation: ScopeBoundaryValidation;

  /** All validation failures */
  failures: ValidationFailure[];

  /** All warnings (non-blocking) */
  warnings: ValidationFailure[];

  /** Summary statistics */
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningCount: number;
  };

  /** Overall pass/fail */
  passed: boolean;

  /** If failed, the primary failure reasons */
  failureReasons: string[];

  /** Recommendations for improvement */
  recommendations?: string[];
}

/**
 * QA configuration (thresholds and settings)
 */
export interface QAConfig {
  /** Minimum words per major heading */
  minWordsPerMajorHeading: number;
  /** Minimum total words */
  minTotalWords: number;
  /** Maximum bullet ratio */
  maxBulletRatio: number;
  /** Require all disclaimers */
  requireDisclaimers: boolean;
  /** Require all artifacts */
  requireAllArtifacts: boolean;
  /** Require all standards covered */
  requireAllStandardsCovered: boolean;
  /** Allow "not applicable" for standards */
  allowNotApplicableStandards: boolean;
  /** Treat warnings as errors */
  strictMode: boolean;
}
