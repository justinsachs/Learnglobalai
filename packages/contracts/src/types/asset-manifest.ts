/**
 * AssetManifest - Complete manifest of all generated assets for a module run
 * This is the final output that documents everything produced by the pipeline
 */

import type {
  ModuleId,
  RunId,
  Version,
  Timestamp,
  Hash,
  ArtifactUri,
  PipelineState
} from './base.js';

/**
 * Hash record for integrity verification
 */
export interface HashRecord {
  /** Algorithm used */
  algorithm: 'sha256';
  /** Hash value */
  hash: Hash;
  /** Timestamp when hash was computed */
  computedAt: Timestamp;
}

/**
 * Artifact reference with metadata
 */
export interface ArtifactReference {
  /** Artifact type identifier */
  type: string;
  /** URI to the stored artifact */
  uri: ArtifactUri;
  /** Content type (MIME) */
  contentType: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Hash for integrity */
  hash: HashRecord;
  /** Generation timestamp */
  generatedAt: Timestamp;
  /** Version of the artifact */
  version: Version;
}

/**
 * Content repository artifacts
 */
export interface ContentRepoArtifacts {
  /** ModuleSpec JSON */
  moduleSpec: ArtifactReference;
  /** Outline JSON */
  outline: ArtifactReference;
  /** SourcePack JSON */
  sourcePackJson: ArtifactReference;
  /** SourcePack Markdown (for NotebookLM) */
  sourcePackMarkdown: ArtifactReference;
  /** QA Report JSON */
  qaReport: ArtifactReference;
  /** Media Prompt Pack JSON */
  mediaPromptPack?: ArtifactReference;
  /** Media Prompt Pack Markdown (for NotebookLM) */
  mediaPromptPackMarkdown?: ArtifactReference;
  /** HeyGen Package JSON */
  heygenPackage?: ArtifactReference;
}

/**
 * NotebookLM integration details
 */
export interface NotebookLmArtifacts {
  /** Whether NotebookLM was used */
  enabled: boolean;
  /** Notebook ID */
  notebookId?: string;
  /** Source document IDs */
  sourceIds?: string[];
  /** Prompt document ID (the "RUN PROMPTS" doc) */
  promptDocId?: string;
  /** Share URL */
  shareUrl?: string;
  /** Creation timestamp */
  createdAt?: Timestamp;
  /** Last sync timestamp */
  lastSyncedAt?: Timestamp;
}

/**
 * HeyGen integration details
 */
export interface HeyGenArtifacts {
  /** Whether HeyGen was used */
  enabled: boolean;
  /** Render job ID */
  renderJobId?: string;
  /** Job status */
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  /** Video URL (when completed) */
  videoUrl?: string;
  /** Video duration in seconds */
  videoDurationSeconds?: number;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Captions URL */
  captionsUrl?: string;
  /** Transcript URL */
  transcriptUrl?: string;
  /** Request timestamp */
  requestedAt?: Timestamp;
  /** Completion timestamp */
  completedAt?: Timestamp;
  /** Error details if failed */
  error?: string;
}

/**
 * Asset placement in LMS
 */
export interface AssetPlacement {
  /** Asset identifier */
  assetId: string;
  /** Asset type */
  assetType: 'video' | 'document' | 'quiz' | 'interactive' | 'link';
  /** Page or section where placed */
  placement: string;
  /** Order within placement */
  order: number;
  /** LMS-specific asset ID */
  lmsAssetId?: string;
}

/**
 * LMS integration details
 */
export interface LmsArtifacts {
  /** Whether LMS publishing was used */
  enabled: boolean;
  /** LMS provider name */
  provider: string;
  /** Module page ID in LMS */
  modulePageId?: string;
  /** Module URL in LMS */
  moduleUrl?: string;
  /** Asset placement map */
  assetPlacementMap: AssetPlacement[];
  /** Publication status */
  status?: 'draft' | 'pending_review' | 'published' | 'archived';
  /** Publication timestamp */
  publishedAt?: Timestamp;
  /** Published by */
  publishedBy?: string;
}

/**
 * Chat configuration details
 */
export interface ChatArtifacts {
  /** Whether chat was configured */
  enabled: boolean;
  /** Configuration ID */
  configId?: string;
  /** Retrieval index ID */
  retrievalIndexId?: string;
  /** Policy ID */
  policyId?: string;
  /** Endpoint URL */
  endpointUrl?: string;
  /** Configuration timestamp */
  configuredAt?: Timestamp;
  /** Sources indexed count */
  sourcesIndexed?: number;
}

/**
 * Audit trail entry
 */
export interface AuditEntry {
  /** Event ID */
  id: string;
  /** Event type */
  eventType: string;
  /** Actor (user or system) */
  actor: string;
  /** Timestamp */
  timestamp: Timestamp;
  /** Previous state */
  fromState?: PipelineState;
  /** New state */
  toState?: PipelineState;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Approval record
 */
export interface ApprovalRecord {
  /** Approver identifier */
  approver: string;
  /** Approval timestamp */
  approvedAt: Timestamp;
  /** Approval scope */
  scope: 'content' | 'publication' | 'full';
  /** Comments */
  comments?: string;
  /** Digital signature (if applicable) */
  signature?: string;
}

/**
 * Complete Asset Manifest
 */
export interface AssetManifest {
  /** Module ID */
  moduleId: ModuleId;

  /** Run ID */
  runId: RunId;

  /** Version */
  version: Version;

  /** Manifest generation timestamp */
  generatedAt: Timestamp;

  /** Final pipeline state */
  finalState: PipelineState;

  /** Whether the run completed successfully */
  successful: boolean;

  /** Content repository artifacts */
  contentRepo: ContentRepoArtifacts;

  /** NotebookLM artifacts */
  notebookLm: NotebookLmArtifacts;

  /** HeyGen artifacts */
  heygen: HeyGenArtifacts;

  /** LMS artifacts */
  lms: LmsArtifacts;

  /** Chat configuration */
  chat: ChatArtifacts;

  /** Audit trail */
  audit: {
    /** All state transitions and events */
    entries: AuditEntry[];
    /** Artifact hashes */
    hashes: Record<string, HashRecord>;
    /** Approval records */
    approvals: ApprovalRecord[];
    /** Total duration in milliseconds */
    totalDurationMs: number;
    /** Start timestamp */
    startedAt: Timestamp;
    /** End timestamp */
    completedAt: Timestamp;
  };

  /** Error details if failed */
  error?: {
    code: string;
    message: string;
    state: PipelineState;
    recoverable: boolean;
    details?: Record<string, unknown>;
  };

  /** Metadata */
  metadata: {
    /** Vertical/brand */
    vertical: string;
    /** Pipeline version used */
    pipelineVersion: string;
    /** Environment */
    environment: 'development' | 'staging' | 'production';
    /** Custom tags */
    tags?: string[];
  };
}

/**
 * Partial manifest for in-progress runs
 */
export interface PartialAssetManifest {
  moduleId: ModuleId;
  runId: RunId;
  version: Version;
  currentState: PipelineState;
  generatedAt: Timestamp;
  contentRepo: Partial<ContentRepoArtifacts>;
  notebookLm: Partial<NotebookLmArtifacts>;
  heygen: Partial<HeyGenArtifacts>;
  lms: Partial<LmsArtifacts>;
  chat: Partial<ChatArtifacts>;
  inProgress: boolean;
}
