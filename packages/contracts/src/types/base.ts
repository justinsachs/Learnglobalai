/**
 * Base types used throughout the LearnGlobal.ai system
 */

/** Unique identifier for a module */
export type ModuleId = string;

/** Unique identifier for a pipeline run */
export type RunId = string;

/** Semantic version string (e.g., "1.0.0") */
export type Version = string;

/** ISO 8601 timestamp string */
export type Timestamp = string;

/** SHA-256 hash string */
export type Hash = string;

/** URI to a stored artifact */
export type ArtifactUri = string;

/** Supported verticals/brands */
export type Vertical =
  | 'medviro'
  | 'clearclaims'
  | 'response-roofing'
  | 'learnglobal'
  | string; // Allow custom verticals

/** Target audience roles */
export type AudienceRole =
  | 'technician'
  | 'supervisor'
  | 'administrator'
  | 'compliance-officer'
  | 'field-worker'
  | 'customer-service'
  | string; // Allow custom roles

/** Artifact types that can be generated */
export type ArtifactType =
  | 'checklist'
  | 'form'
  | 'decision-tree'
  | 'flowchart'
  | 'reference-table'
  | 'scenario-script'
  | 'quiz'
  | 'glossary';

/** Media asset types */
export type MediaType =
  | 'video'
  | 'audio'
  | 'infographic'
  | 'diagram'
  | 'animation';

/** Pipeline states for the orchestrator */
export enum PipelineState {
  DRAFT_MODULE_SPEC = 'DRAFT_MODULE_SPEC',
  OUTLINE_GENERATED = 'OUTLINE_GENERATED',
  SOURCEPACK_GENERATED = 'SOURCEPACK_GENERATED',
  QA_PASSED = 'QA_PASSED',
  NOTEBOOK_CREATED = 'NOTEBOOK_CREATED',
  NOTEBOOK_SOURCES_UPLOADED = 'NOTEBOOK_SOURCES_UPLOADED',
  MEDIA_PROMPT_PACK_GENERATED = 'MEDIA_PROMPT_PACK_GENERATED',
  HEYGEN_SCRIPT_GENERATED = 'HEYGEN_SCRIPT_GENERATED',
  HEYGEN_VIDEO_REQUESTED = 'HEYGEN_VIDEO_REQUESTED',
  HEYGEN_VIDEO_READY = 'HEYGEN_VIDEO_READY',
  LMS_PUBLISHED = 'LMS_PUBLISHED',
  CHAT_CONFIGURED = 'CHAT_CONFIGURED',
  AUDIT_FINALIZED = 'AUDIT_FINALIZED',
  FAILED = 'FAILED'
}

/** State transition result */
export interface StateTransition {
  fromState: PipelineState;
  toState: PipelineState;
  timestamp: Timestamp;
  actor: string;
  runId: RunId;
  metadata?: Record<string, unknown>;
}

/** Error with actionable information */
export interface ActionableError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestedAction?: string;
  retryable: boolean;
  retryAfterMs?: number;
  context?: Record<string, unknown>;
}

/** Audit event for governance */
export interface AuditEvent {
  id: string;
  runId: RunId;
  moduleId: ModuleId;
  eventType: string;
  actor: string;
  timestamp: Timestamp;
  fromState?: PipelineState;
  toState?: PipelineState;
  details: Record<string, unknown>;
  promptHash?: Hash;
  responseHash?: Hash;
}
