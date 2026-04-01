/**
 * NotebookLM Enterprise Connector
 * Supports both real API and mock implementation
 */

import {
  type ConnectorLogger,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  createConnectorError,
} from '../types.js';

export interface NotebookLmConfig {
  apiUrl: string;
  projectId: string;
  serviceAccountKeyPath?: string;
  enabled: boolean;
  retryConfig?: RetryConfig;
}

export interface CreateNotebookResult {
  notebookId: string;
  title: string;
  createdAt: string;
}

export interface UploadSourceResult {
  sourceId: string;
  notebookId: string;
  title: string;
  uploadedAt: string;
}

export interface ShareNotebookResult {
  notebookId: string;
  shareUrl: string;
}

/**
 * NotebookLM Connector Interface
 */
export interface NotebookLmConnector {
  createNotebook(title: string, projectId: string): Promise<CreateNotebookResult>;
  uploadSource(notebookId: string, title: string, content: string): Promise<UploadSourceResult>;
  shareNotebook(notebookId: string): Promise<ShareNotebookResult>;
  listNotebooks(projectId: string): Promise<Array<{ notebookId: string; title: string }>>;
}

/**
 * Mock NotebookLM Connector for development/testing
 */
export class MockNotebookLmConnector implements NotebookLmConnector {
  private notebooks: Map<string, { title: string; sources: string[] }> = new Map();
  private sourceCounter = 0;
  private logger?: ConnectorLogger;

  constructor(logger?: ConnectorLogger) {
    this.logger = logger;
  }

  async createNotebook(title: string, projectId: string): Promise<CreateNotebookResult> {
    const notebookId = `nb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.notebooks.set(notebookId, { title, sources: [] });

    this.logger?.info('Mock: Created notebook', { notebookId, title, projectId });

    return {
      notebookId,
      title,
      createdAt: new Date().toISOString(),
    };
  }

  async uploadSource(notebookId: string, title: string, content: string): Promise<UploadSourceResult> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook) {
      throw createConnectorError(
        'notebooklm',
        'uploadSource',
        'NOTEBOOK_NOT_FOUND',
        `Notebook not found: ${notebookId}`,
        false
      );
    }

    const sourceId = `src-${++this.sourceCounter}`;
    notebook.sources.push(sourceId);

    this.logger?.info('Mock: Uploaded source', {
      notebookId,
      sourceId,
      title,
      contentLength: content.length,
    });

    return {
      sourceId,
      notebookId,
      title,
      uploadedAt: new Date().toISOString(),
    };
  }

  async shareNotebook(notebookId: string): Promise<ShareNotebookResult> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook) {
      throw createConnectorError(
        'notebooklm',
        'shareNotebook',
        'NOTEBOOK_NOT_FOUND',
        `Notebook not found: ${notebookId}`,
        false
      );
    }

    const shareUrl = `https://notebooklm.google.com/notebook/${notebookId}`;

    this.logger?.info('Mock: Shared notebook', { notebookId, shareUrl });

    return {
      notebookId,
      shareUrl,
    };
  }

  async listNotebooks(projectId: string): Promise<Array<{ notebookId: string; title: string }>> {
    const result = Array.from(this.notebooks.entries()).map(([id, data]) => ({
      notebookId: id,
      title: data.title,
    }));

    this.logger?.info('Mock: Listed notebooks', { projectId, count: result.length });

    return result;
  }
}

/**
 * Real NotebookLM Enterprise Connector
 *
 * Integrates with Google's NotebookLM Enterprise API for creating
 * AI-powered notebooks with custom content sources.
 *
 * Note: NotebookLM Enterprise API access requires:
 * 1. Google Cloud project with NotebookLM Enterprise enabled
 * 2. Service account with appropriate permissions
 * 3. OAuth 2.0 credentials or API key
 */
export class RealNotebookLmConnector implements NotebookLmConnector {
  private config: NotebookLmConfig;
  private retryConfig: RetryConfig;
  private logger?: ConnectorLogger;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(config: NotebookLmConfig, logger?: ConnectorLogger) {
    this.config = config;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    this.logger = logger;
  }

  /**
   * Get or refresh the access token for API calls
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    this.logger?.info('Refreshing NotebookLM access token');

    // Use service account credentials for authentication
    if (this.config.serviceAccountKeyPath) {
      const credentials = await this.loadServiceAccountCredentials();
      const token = await this.exchangeCredentialsForToken(credentials);
      this.accessToken = token.access_token;
      this.tokenExpiry = new Date(Date.now() + (token.expires_in - 60) * 1000);
      return this.accessToken;
    }

    throw createConnectorError(
      'notebooklm',
      'getAccessToken',
      'AUTH_ERROR',
      'No valid authentication credentials configured. Set serviceAccountKeyPath in config.',
      false
    );
  }

  /**
   * Load service account credentials from file
   */
  private async loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
    const fs = await import('fs/promises');
    const keyPath = this.config.serviceAccountKeyPath!;

    try {
      const content = await fs.readFile(keyPath, 'utf-8');
      return JSON.parse(content) as ServiceAccountCredentials;
    } catch (error) {
      throw createConnectorError(
        'notebooklm',
        'loadCredentials',
        'AUTH_ERROR',
        `Failed to load service account key from ${keyPath}: ${error}`,
        false
      );
    }
  }

  /**
   * Exchange service account credentials for an access token
   */
  private async exchangeCredentialsForToken(
    credentials: ServiceAccountCredentials
  ): Promise<{ access_token: string; expires_in: number }> {
    const jwt = await this.createSignedJwt(credentials);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw createConnectorError(
        'notebooklm',
        'getToken',
        'AUTH_ERROR',
        `Failed to get access token: ${error}`,
        response.status >= 500
      );
    }

    return response.json();
  }

  /**
   * Create a signed JWT for service account authentication
   */
  private async createSignedJwt(credentials: ServiceAccountCredentials): Promise<string> {
    const crypto = await import('crypto');

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(credentials.private_key, 'base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.config.apiUrl}${endpoint}`;

    this.logger?.debug('NotebookLM API request', { method, url });

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': this.config.projectId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      const isRetryable = response.status >= 500 || response.status === 429;

      throw createConnectorError(
        'notebooklm',
        endpoint,
        `HTTP_${response.status}`,
        `API request failed: ${error}`,
        isRetryable
      );
    }

    return response.json() as T;
  }

  async createNotebook(title: string, projectId: string): Promise<CreateNotebookResult> {
    return withRetry(
      async () => {
        this.logger?.info('Creating notebook via NotebookLM Enterprise API', { title, projectId });

        const response = await this.apiRequest<{
          name: string;
          displayName: string;
          createTime: string;
        }>('POST', `/v1/projects/${projectId}/notebooks`, {
          displayName: title,
          description: `Created by LearnGlobal.ai pipeline`,
        });

        // Extract notebook ID from resource name (projects/{project}/notebooks/{notebook})
        const notebookId = response.name.split('/').pop() || response.name;

        this.logger?.info('Notebook created successfully', { notebookId, title });

        return {
          notebookId,
          title: response.displayName,
          createdAt: response.createTime,
        };
      },
      this.retryConfig,
      this.logger,
      'createNotebook'
    );
  }

  async uploadSource(notebookId: string, title: string, content: string): Promise<UploadSourceResult> {
    return withRetry(
      async () => {
        this.logger?.info('Uploading source to NotebookLM', { notebookId, title, contentLength: content.length });

        const response = await this.apiRequest<{
          name: string;
          displayName: string;
          createTime: string;
        }>(
          'POST',
          `/v1/projects/${this.config.projectId}/notebooks/${notebookId}/sources`,
          {
            displayName: title,
            textContent: {
              text: content,
            },
          }
        );

        // Extract source ID from resource name
        const sourceId = response.name.split('/').pop() || response.name;

        this.logger?.info('Source uploaded successfully', { notebookId, sourceId, title });

        return {
          sourceId,
          notebookId,
          title: response.displayName,
          uploadedAt: response.createTime,
        };
      },
      this.retryConfig,
      this.logger,
      'uploadSource'
    );
  }

  async shareNotebook(notebookId: string): Promise<ShareNotebookResult> {
    return withRetry(
      async () => {
        this.logger?.info('Sharing notebook', { notebookId });

        // Set IAM policy to allow sharing
        await this.apiRequest<void>(
          'POST',
          `/v1/projects/${this.config.projectId}/notebooks/${notebookId}:setIamPolicy`,
          {
            policy: {
              bindings: [
                {
                  role: 'roles/notebooklm.viewer',
                  members: ['allAuthenticatedUsers'],
                },
              ],
            },
          }
        );

        // Generate share URL
        const shareUrl = `https://notebooklm.google.com/notebook/${notebookId}?project=${this.config.projectId}`;

        this.logger?.info('Notebook shared successfully', { notebookId, shareUrl });

        return {
          notebookId,
          shareUrl,
        };
      },
      this.retryConfig,
      this.logger,
      'shareNotebook'
    );
  }

  async listNotebooks(projectId: string): Promise<Array<{ notebookId: string; title: string }>> {
    return withRetry(
      async () => {
        this.logger?.info('Listing notebooks', { projectId });

        const response = await this.apiRequest<{
          notebooks: Array<{
            name: string;
            displayName: string;
          }>;
        }>('GET', `/v1/projects/${projectId}/notebooks`);

        const notebooks = (response.notebooks || []).map(nb => ({
          notebookId: nb.name.split('/').pop() || nb.name,
          title: nb.displayName,
        }));

        this.logger?.info('Listed notebooks successfully', { projectId, count: notebooks.length });

        return notebooks;
      },
      this.retryConfig,
      this.logger,
      'listNotebooks'
    );
  }
}

/**
 * Service account credentials structure
 */
interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

/**
 * Create NotebookLM connector based on configuration
 */
export function createNotebookLmConnector(
  config: NotebookLmConfig,
  logger?: ConnectorLogger
): NotebookLmConnector {
  if (!config.enabled) {
    return new MockNotebookLmConnector(logger);
  }

  // Use mock if no API URL is configured
  if (!config.apiUrl || config.apiUrl.includes('placeholder')) {
    logger?.warn('NotebookLM enabled but no valid API URL, using mock');
    return new MockNotebookLmConnector(logger);
  }

  return new RealNotebookLmConnector(config, logger);
}
