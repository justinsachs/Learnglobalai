/**
 * ModuleSpec - Input specification for generating a training module
 * This is the primary input contract that drives the entire pipeline
 */

import type {
  ModuleId,
  Version,
  Vertical,
  AudienceRole,
  ArtifactType,
  Timestamp
} from './base.js';

/**
 * Reference to a standard, regulation, or SOP section
 */
export interface StandardReference {
  /** Name of the standard (e.g., "OSHA 1910.134", "ISO 14001") */
  standardName: string;
  /** Section or clause reference (e.g., "Section 5.2.1") */
  sectionRef: string;
  /** Human-readable summary of the requirement */
  requirementSummary: string;
  /** Optional: full text excerpt for training context */
  fullText?: string;
  /** Optional: URL to authoritative source */
  sourceUrl?: string;
}

/**
 * Decision point within a scenario
 */
export interface DecisionPoint {
  /** Unique ID within the scenario */
  id: string;
  /** The situation or question posed */
  situation: string;
  /** Available choices */
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  /** Consequences or next steps based on choice */
  consequences?: string;
}

/**
 * Training scenario for experiential learning
 */
export interface Scenario {
  /** Unique ID */
  id: string;
  /** Scenario title */
  title: string;
  /** Setting and background context */
  context: string;
  /** Role the learner plays */
  learnerRole?: AudienceRole;
  /** Decision points in the scenario */
  decisionPoints: DecisionPoint[];
  /** Learning objectives addressed */
  objectivesAddressed?: string[];
  /** Standards demonstrated */
  standardsAddressed?: string[];
}

/**
 * Required artifact specification
 */
export interface RequiredArtifact {
  /** Unique ID */
  id: string;
  /** Type of artifact */
  type: ArtifactType;
  /** Description of what this artifact should contain */
  description: string;
  /** Criteria that must be met for this artifact to pass QA */
  passCriteria: string[];
  /** Optional: specific section where this should appear */
  targetSection?: string;
}

/**
 * Content constraints for quality enforcement
 */
export interface ContentConstraints {
  /** Minimum words per major heading/section */
  minWordsPerMajorHeading: number;
  /** Minimum total words for the entire SourcePack */
  minTotalWords: number;
  /** Maximum allowed ratio of bullet points (0.0 - 1.0) */
  maxBulletRatio: number;
  /** Formatting rules that must not be violated */
  forbiddenFormattingRules: string[];
  /** Required disclaimers that must appear */
  requiredDisclaimers: string[];
  /** Required sections that must exist */
  requiredSections?: string[];
}

/**
 * Safety boundaries for content generation
 */
export interface SafetyBoundaries {
  /** Clear scope of what advice can be given */
  scopeOfAdvice: string;
  /** Disclaimers that must be included */
  disclaimers: string[];
  /** Triggers that should escalate to human review */
  escalationTriggers: string[];
  /** Topics that must never be addressed */
  prohibitedTopics?: string[];
  /** Topics that require extra caution/disclaimers */
  sensitiveTopics?: string[];
}

/**
 * Media generation preferences
 */
export interface MediaPreferences {
  /** Target video length in minutes */
  videoMinutesTarget: number;
  /** Avatar style for video (professional, casual, etc.) */
  avatarStyle: string;
  /** Audio tone (formal, conversational, etc.) */
  audioTone: string;
  /** Infographic style */
  infographicStyle: string;
  /** Preferred color scheme */
  colorScheme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Background music preference */
  backgroundMusic?: 'none' | 'subtle' | 'moderate';
  /** Pacing preference */
  pacing?: 'slow' | 'moderate' | 'fast';
}

/**
 * Complete Module Specification
 * This is the primary input that drives the entire pipeline
 */
export interface ModuleSpec {
  /** Unique module identifier */
  moduleId: ModuleId;

  /** Human-readable title */
  title: string;

  /** Vertical/brand this module belongs to */
  vertical: Vertical;

  /** Semantic version */
  version: Version;

  /** Author/creator identifier */
  author: string;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;

  /** Brief description/abstract */
  description: string;

  /** Target audience roles */
  targetAudienceRoles: AudienceRole[];

  /** Learning objectives (what learners will be able to do) */
  learningObjectives: string[];

  /** Mapped standards/regulations */
  standardsMap: StandardReference[];

  /** Training scenarios */
  scenarios: Scenario[];

  /** Required artifacts to generate */
  requiredArtifacts: RequiredArtifact[];

  /** Content constraints */
  constraints: ContentConstraints;

  /** Safety boundaries */
  safetyBoundaries: SafetyBoundaries;

  /** Media preferences */
  mediaPreferences: MediaPreferences;

  /** Prerequisites (other module IDs) */
  prerequisites?: ModuleId[];

  /** Estimated completion time in minutes */
  estimatedDurationMinutes?: number;

  /** Tags for categorization */
  tags?: string[];

  /** Custom metadata for vertical-specific needs */
  metadata?: Record<string, unknown>;
}

/**
 * ModuleSpec creation input (subset of fields that are user-provided)
 */
export interface ModuleSpecInput {
  title: string;
  vertical: Vertical;
  author: string;
  description: string;
  targetAudienceRoles: AudienceRole[];
  learningObjectives: string[];
  standardsMap: StandardReference[];
  scenarios: Scenario[];
  requiredArtifacts: RequiredArtifact[];
  constraints: ContentConstraints;
  safetyBoundaries: SafetyBoundaries;
  mediaPreferences: MediaPreferences;
  prerequisites?: ModuleId[];
  estimatedDurationMinutes?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
