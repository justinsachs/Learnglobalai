/**
 * Connector interface types for MCP-style tool integrations
 */

import type { Timestamp } from './base.js';

/**
 * Connector authentication scope
 */
export interface ConnectorScope {
  /** Scope name */
  name: string;
  /** Description */
  description: string;
  /** Permissions granted */
  permissions: string[];
}

/**
 * Connector capability
 */
export interface ConnectorCapability {
  /** Capability name */
  name: string;
  /** Description */
  description: string;
  /** Required scopes */
  requiredScopes: string[];
  /** Rate limits */
  rateLimit?: {
    requests: number;
    periodSeconds: number;
  };
}

/**
 * Redaction rule for logging
 */
export interface RedactionRule {
  /** Field path to redact */
  fieldPath: string;
  /** Redaction method */
  method: 'mask' | 'hash' | 'remove';
  /** Pattern to match (for partial redaction) */
  pattern?: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retries */
  maxRetries: number;
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Retryable error codes */
  retryableErrors: string[];
}

/**
 * Base connector configuration
 */
export interface ConnectorConfig {
  /** Connector ID */
  id: string;
  /** Connector name */
  name: string;
  /** Connector type */
  type: string;
  /** Whether enabled */
  enabled: boolean;
  /** API endpoint URL */
  endpoint?: string;
  /** Auth scopes */
  scopes: ConnectorScope[];
  /** Capabilities */
  capabilities: ConnectorCapability[];
  /** Redaction rules */
  redactionRules: RedactionRule[];
  /** Retry configuration */
  retryConfig: RetryConfig;
  /** Timeout in ms */
  timeoutMs: number;
  /** Created timestamp */
  createdAt: Timestamp;
  /** Updated timestamp */
  updatedAt: Timestamp;
}

/**
 * Connector request log entry
 */
export interface ConnectorRequestLog {
  /** Log ID */
  id: string;
  /** Connector ID */
  connectorId: string;
  /** Run ID */
  runId: string;
  /** Operation name */
  operation: string;
  /** Request timestamp */
  requestedAt: Timestamp;
  /** Response timestamp */
  respondedAt?: Timestamp;
  /** Duration in ms */
  durationMs?: number;
  /** Request body (redacted) */
  requestBody?: Record<string, unknown>;
  /** Response body (redacted) */
  responseBody?: Record<string, unknown>;
  /** Status code */
  statusCode?: number;
  /** Success */
  success: boolean;
  /** Error */
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  /** Retry attempt number */
  retryAttempt?: number;
}

/**
 * Typed connector error
 */
export interface ConnectorError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Connector name */
  connector: string;
  /** Operation that failed */
  operation: string;
  /** Whether it's retryable */
  retryable: boolean;
  /** Suggested retry after (ms) */
  retryAfterMs?: number;
  /** Original error details */
  details?: Record<string, unknown>;
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Content Repository connector types
 */
export namespace ContentRepo {
  export interface PutObjectRequest {
    key: string;
    body: Buffer | string;
    contentType: string;
    metadata?: Record<string, string>;
  }

  export interface PutObjectResponse {
    key: string;
    versionId?: string;
    etag: string;
    uri: string;
  }

  export interface GetObjectRequest {
    key: string;
    versionId?: string;
  }

  export interface GetObjectResponse {
    key: string;
    body: Buffer;
    contentType: string;
    metadata: Record<string, string>;
    versionId?: string;
    lastModified: Timestamp;
  }

  export interface ListObjectsRequest {
    prefix: string;
    maxKeys?: number;
    continuationToken?: string;
  }

  export interface ListObjectsResponse {
    objects: Array<{
      key: string;
      size: number;
      lastModified: Timestamp;
      etag: string;
    }>;
    isTruncated: boolean;
    continuationToken?: string;
  }

  export interface DeleteObjectRequest {
    key: string;
    versionId?: string;
  }

  export interface DeleteObjectResponse {
    key: string;
    deleted: boolean;
  }
}

/**
 * NotebookLM connector types
 */
export namespace NotebookLm {
  export interface CreateNotebookRequest {
    title: string;
    description?: string;
    projectId: string;
  }

  export interface CreateNotebookResponse {
    notebookId: string;
    title: string;
    createdAt: Timestamp;
    shareUrl?: string;
  }

  export interface UploadSourceRequest {
    notebookId: string;
    title: string;
    content: string;
    contentType: 'text/plain' | 'text/markdown' | 'application/pdf';
  }

  export interface UploadSourceResponse {
    sourceId: string;
    notebookId: string;
    title: string;
    uploadedAt: Timestamp;
  }

  export interface ShareNotebookRequest {
    notebookId: string;
    shareType: 'view' | 'edit';
    emails?: string[];
  }

  export interface ShareNotebookResponse {
    notebookId: string;
    shareUrl: string;
    sharedWith: string[];
  }

  export interface ListNotebooksRequest {
    projectId: string;
    pageSize?: number;
    pageToken?: string;
  }

  export interface ListNotebooksResponse {
    notebooks: Array<{
      notebookId: string;
      title: string;
      createdAt: Timestamp;
      updatedAt: Timestamp;
    }>;
    nextPageToken?: string;
  }
}

/**
 * HeyGen connector types
 */
export namespace HeyGen {
  export interface CreateVideoRequest {
    title: string;
    avatarId: string;
    voiceId: string;
    script: string;
    background?: string;
    resolution?: '720p' | '1080p' | '4k';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    webhookUrl?: string;
    templateId?: string;
    templateVariables?: Record<string, string>;
  }

  export interface CreateVideoResponse {
    jobId: string;
    status: 'pending' | 'processing';
    estimatedCompletionSeconds?: number;
  }

  export interface PollStatusRequest {
    jobId: string;
  }

  export interface PollStatusResponse {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    videoUrl?: string;
    thumbnailUrl?: string;
    duration?: number;
    error?: string;
  }

  export interface ListAvatarsResponse {
    avatars: Array<{
      avatarId: string;
      name: string;
      previewUrl: string;
      style: string;
    }>;
  }

  export interface ListVoicesResponse {
    voices: Array<{
      voiceId: string;
      name: string;
      language: string;
      gender: string;
      previewUrl?: string;
    }>;
  }
}

/**
 * LMS connector types
 */
export namespace Lms {
  export interface CreateModuleRequest {
    title: string;
    description: string;
    vertical: string;
    metadata?: Record<string, unknown>;
  }

  export interface CreateModuleResponse {
    modulePageId: string;
    moduleUrl: string;
    createdAt: Timestamp;
  }

  export interface UploadAssetRequest {
    modulePageId: string;
    assetType: 'video' | 'document' | 'quiz' | 'interactive' | 'link';
    title: string;
    content: Buffer | string;
    contentType: string;
    metadata?: Record<string, unknown>;
  }

  export interface UploadAssetResponse {
    assetId: string;
    assetUrl: string;
    uploadedAt: Timestamp;
  }

  export interface AttachAssetRequest {
    modulePageId: string;
    assetId: string;
    placement: string;
    order: number;
  }

  export interface AttachAssetResponse {
    attached: boolean;
    placement: string;
  }

  export interface PublishModuleRequest {
    modulePageId: string;
    publishedBy: string;
  }

  export interface PublishModuleResponse {
    modulePageId: string;
    status: 'published';
    publishedAt: Timestamp;
    moduleUrl: string;
  }

  export interface LmsModuleBundle {
    moduleId: string;
    title: string;
    description: string;
    vertical: string;
    version: string;
    pages: Array<{
      pageId: string;
      title: string;
      content: string;
      order: number;
      assets: Array<{
        assetId: string;
        type: string;
        title: string;
        url: string;
        order: number;
      }>;
    }>;
    metadata: Record<string, unknown>;
    generatedAt: Timestamp;
  }
}
