/**
 * Orchestrator Types
 */

import type {
  PipelineState,
  ModuleSpec,
  Outline,
  SourcePack,
  QAReport,
  MediaPromptPack,
  HeyGenPackage,
  AssetManifest,
  ActionableError,
} from '@learnglobal/contracts';

/**
 * Run context containing all artifacts and state
 */
export interface RunContext {
  runId: string;
  moduleId: string;
  version: string;
  currentState: PipelineState;
  previousState?: PipelineState;
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  config: RunConfig;

  // Artifacts
  moduleSpec: ModuleSpec;
  outline?: Outline;
  sourcePack?: SourcePack;
  qaReport?: QAReport;
  mediaPromptPack?: MediaPromptPack;
  heygenPackage?: HeyGenPackage;
  assetManifest?: AssetManifest;

  // External integrations state
  notebookLmState?: NotebookLmState;
  heygenState?: HeyGenState;
  lmsState?: LmsState;
  chatState?: ChatState;

  // Error state
  error?: ActionableError;

  // Checkpoints for resumability
  checkpoint?: StateCheckpoint;

  // Metadata
  metadata: Record<string, unknown>;
}

/**
 * Run configuration
 */
export interface RunConfig {
  /** Skip NotebookLM integration */
  skipNotebookLm?: boolean;
  /** Skip HeyGen video generation */
  skipHeygen?: boolean;
  /** Skip LMS publishing */
  skipLmsPublish?: boolean;
  /** Skip chat configuration */
  skipChat?: boolean;
  /** Auto-approve for LMS publishing (dev mode) */
  autoApprove?: boolean;
  /** Quality gate strictness */
  strictQualityGates?: boolean;
  /** Vertical-specific config overrides */
  verticalOverrides?: Record<string, unknown>;
}

/**
 * State checkpoint for resumability
 */
export interface StateCheckpoint {
  state: PipelineState;
  timestamp: string;
  artifactHashes: Record<string, string>;
  externalState: {
    notebookLm?: NotebookLmState;
    heygen?: HeyGenState;
    lms?: LmsState;
  };
}

/**
 * NotebookLM integration state
 */
export interface NotebookLmState {
  notebookId?: string;
  sourceIds: string[];
  promptDocId?: string;
  shareUrl?: string;
  createdAt?: string;
  lastSyncedAt?: string;
}

/**
 * HeyGen integration state
 */
export interface HeyGenState {
  jobId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  requestedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}

/**
 * LMS integration state
 */
export interface LmsState {
  modulePageId?: string;
  moduleUrl?: string;
  assetIds: string[];
  status: 'draft' | 'pending_approval' | 'published';
  publishedAt?: string;
  publishedBy?: string;
}

/**
 * Chat integration state
 */
export interface ChatState {
  configId?: string;
  retrievalIndexId?: string;
  policyId?: string;
  sourcesIndexed: number;
  configuredAt?: string;
}

/**
 * State handler result
 */
export interface StateHandlerResult {
  success: boolean;
  nextState?: PipelineState;
  error?: ActionableError;
  artifacts?: Partial<RunContext>;
  checkpoint?: StateCheckpoint;
}

/**
 * State handler function type
 */
export type StateHandler = (
  context: RunContext,
  dependencies: OrchestratorDependencies
) => Promise<StateHandlerResult>;

/**
 * Orchestrator dependencies (injected)
 */
export interface OrchestratorDependencies {
  // Data access
  saveRunState: (context: RunContext) => Promise<void>;
  loadRunState: (runId: string) => Promise<RunContext | null>;
  saveArtifact: (runId: string, type: string, data: unknown) => Promise<string>;
  loadArtifact: (uri: string) => Promise<unknown>;

  // Audit
  logAuditEvent: (event: AuditEventInput) => Promise<void>;
  getAuditEntries: (runId: string) => Promise<AuditEntry[]>;

  // Connectors
  contentRepo: ContentRepoConnector;
  llmProvider: LLMProviderConnector;
  notebookLm?: NotebookLmConnector;
  heygen?: HeyGenConnector;
  lms: LmsConnector;
  chat?: ChatConnector;

  // Config
  getVerticalConfig: (vertical: string) => Promise<VerticalConfigData>;

  // Utilities
  logger: Logger;
}

/**
 * Audit event input
 */
export interface AuditEventInput {
  runId: string;
  moduleId: string;
  eventType: string;
  actor: string;
  fromState?: PipelineState;
  toState?: PipelineState;
  details: Record<string, unknown>;
  promptHash?: string;
  responseHash?: string;
}

/**
 * Content repository connector interface
 */
export interface ContentRepoConnector {
  putObject(key: string, body: Buffer | string, contentType: string): Promise<{ uri: string; etag: string }>;
  getObject(key: string): Promise<{ body: Buffer; contentType: string }>;
  listObjects(prefix: string): Promise<Array<{ key: string; size: number }>>;
  deleteObject(key: string): Promise<void>;
}

/**
 * LLM provider connector interface
 */
export interface LLMProviderConnector {
  generateOutline(spec: ModuleSpec, template: string): Promise<{ outline: Outline; usage: TokenUsage }>;
  generateSourcePack(spec: ModuleSpec, outline: Outline, template: string): Promise<{ sourcePack: SourcePack; usage: TokenUsage }>;
  generateQAReport(spec: ModuleSpec, sourcePack: SourcePack): Promise<{ qaReport: QAReport; usage: TokenUsage }>;
  generateMediaPromptPack(spec: ModuleSpec, sourcePack: SourcePack, template: string): Promise<{ mediaPromptPack: MediaPromptPack; usage: TokenUsage }>;
  generateHeyGenPackage(spec: ModuleSpec, mediaPromptPack: MediaPromptPack, template: string): Promise<{ heygenPackage: HeyGenPackage; usage: TokenUsage }>;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * NotebookLM connector interface
 */
export interface NotebookLmConnector {
  createNotebook(title: string, projectId: string): Promise<{ notebookId: string }>;
  uploadSource(notebookId: string, title: string, content: string): Promise<{ sourceId: string }>;
  shareNotebook(notebookId: string): Promise<{ shareUrl: string }>;
}

/**
 * HeyGen connector interface
 */
export interface HeyGenConnector {
  createVideo(script: string, avatarId: string, voiceId: string, options?: Record<string, unknown>): Promise<{ jobId: string }>;
  pollStatus(jobId: string): Promise<{ status: string; videoUrl?: string; error?: string }>;
}

/**
 * LMS connector interface
 */
export interface LmsConnector {
  createModule(title: string, description: string, metadata: Record<string, unknown>): Promise<{ modulePageId: string; moduleUrl: string }>;
  uploadAsset(modulePageId: string, assetType: string, title: string, content: Buffer | string): Promise<{ assetId: string }>;
  attachAsset(modulePageId: string, assetId: string, placement: string, order: number): Promise<void>;
  publish(modulePageId: string, publishedBy: string): Promise<{ moduleUrl: string }>;
}

/**
 * Chat connector interface
 */
export interface ChatConnector {
  createConfig(moduleId: string, sources: Array<{ id: string; content: string }>): Promise<{ configId: string; indexId: string }>;
  indexSources(configId: string, sources: Array<{ id: string; content: string }>): Promise<{ indexed: number }>;
}

/**
 * Vertical configuration data
 */
export interface VerticalConfigData {
  vertical: string;
  templates: {
    outline: string;
    sourcepack: string;
    qa: string;
    mediaPromptPack: string;
    heygenScript: string;
  };
  qualityGates: {
    minTotalWords: number;
    minWordsPerHeading: number;
    maxBulletRatio: number;
    requireDisclaimers: boolean;
  };
  disclaimers: string[];
  mediaConfig: {
    avatarId?: string;
    voiceId?: string;
    videoMinutes: number;
  };
  chatPolicy: {
    allowedTopics: string[];
    prohibitedTopics: string[];
    disclaimers: string[];
  };
}

/**
 * Logger interface
 */
export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Audit entry returned from storage
 */
export interface AuditEntry {
  eventType: string;
  actor: string;
  fromState?: string;
  toState?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Orchestrator event types
 */
export type OrchestratorEvent =
  | { type: 'run_started'; runId: string; moduleId: string }
  | { type: 'state_changed'; runId: string; fromState: PipelineState | null; toState: PipelineState }
  | { type: 'artifact_generated'; runId: string; artifactType: string; hash: string }
  | { type: 'error_occurred'; runId: string; error: ActionableError }
  | { type: 'run_completed'; runId: string; success: boolean }
  | { type: 'run_paused'; runId: string; checkpoint: StateCheckpoint }
  | { type: 'run_resumed'; runId: string; fromState: PipelineState };
