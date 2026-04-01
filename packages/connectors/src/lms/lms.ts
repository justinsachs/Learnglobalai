/**
 * LMS Adapter with pluggable providers
 * Includes FileSystem provider and generic interface
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import {
  type ConnectorLogger,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  createConnectorError,
} from '../types.js';

export interface LmsConfig {
  provider: string;
  outputPath?: string;
  apiUrl?: string;
  apiKey?: string;
  retryConfig?: RetryConfig;
}

export interface CreateModuleResult {
  modulePageId: string;
  moduleUrl: string;
  createdAt: string;
}

export interface UploadAssetResult {
  assetId: string;
  assetUrl: string;
  uploadedAt: string;
}

export interface PublishResult {
  modulePageId: string;
  moduleUrl: string;
  publishedAt: string;
}

/**
 * LMS Connector Interface
 */
export interface LmsConnector {
  createModule(title: string, description: string, metadata: Record<string, unknown>): Promise<CreateModuleResult>;
  uploadAsset(modulePageId: string, assetType: string, title: string, content: Buffer | string): Promise<UploadAssetResult>;
  attachAsset(modulePageId: string, assetId: string, placement: string, order: number): Promise<void>;
  publish(modulePageId: string, publishedBy: string): Promise<PublishResult>;
  getModuleStatus(modulePageId: string): Promise<{ status: string; url?: string }>;
}

/**
 * LMS Module Bundle structure (for FileSystem provider)
 */
export interface LmsModuleBundle {
  moduleId: string;
  title: string;
  description: string;
  vertical: string;
  version: string;
  status: 'draft' | 'published';
  pages: Array<{
    pageId: string;
    title: string;
    content: string;
    order: number;
    assets: Array<{
      assetId: string;
      type: string;
      title: string;
      filename: string;
      placement: string;
      order: number;
    }>;
  }>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

/**
 * FileSystem LMS Provider
 * Writes publishable JSON bundles that can be imported manually
 */
export class FileSystemLmsConnector implements LmsConnector {
  private outputPath: string;
  private modules: Map<string, LmsModuleBundle> = new Map();
  private assetCounter = 0;
  private logger?: ConnectorLogger;

  constructor(outputPath: string, logger?: ConnectorLogger) {
    this.outputPath = outputPath;
    this.logger = logger;
  }

  async createModule(
    title: string,
    description: string,
    metadata: Record<string, unknown>
  ): Promise<CreateModuleResult> {
    const modulePageId = `lms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const bundle: LmsModuleBundle = {
      moduleId: (metadata.moduleId as string) || modulePageId,
      title,
      description,
      vertical: (metadata.vertical as string) || 'default',
      version: (metadata.version as string) || '1.0.0',
      status: 'draft',
      pages: [
        {
          pageId: 'main',
          title,
          content: '',
          order: 1,
          assets: [],
        },
      ],
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.modules.set(modulePageId, bundle);

    // Create output directory
    const modulePath = join(this.outputPath, bundle.vertical, modulePageId);
    await fs.mkdir(modulePath, { recursive: true });

    this.logger?.info('FileSystem LMS: Created module', { modulePageId, title });

    return {
      modulePageId,
      moduleUrl: `file://${modulePath}`,
      createdAt: bundle.createdAt,
    };
  }

  async uploadAsset(
    modulePageId: string,
    assetType: string,
    title: string,
    content: Buffer | string
  ): Promise<UploadAssetResult> {
    const bundle = this.modules.get(modulePageId);
    if (!bundle) {
      throw createConnectorError(
        'lms',
        'uploadAsset',
        'MODULE_NOT_FOUND',
        `Module not found: ${modulePageId}`,
        false
      );
    }

    const assetId = `asset-${++this.assetCounter}`;
    const extension = this.getExtension(assetType, content);
    const filename = `${assetId}${extension}`;

    // Write asset to disk
    const modulePath = join(this.outputPath, bundle.vertical, modulePageId);
    const assetPath = join(modulePath, 'assets');
    await fs.mkdir(assetPath, { recursive: true });

    const assetFilePath = join(assetPath, filename);

    if (typeof content === 'string') {
      // If it's a URL (for video), just store the reference
      if (content.startsWith('http')) {
        await fs.writeFile(
          assetFilePath + '.json',
          JSON.stringify({ type: assetType, title, url: content }, null, 2)
        );
      } else {
        await fs.writeFile(assetFilePath, content, 'utf-8');
      }
    } else {
      await fs.writeFile(assetFilePath, content);
    }

    this.logger?.info('FileSystem LMS: Uploaded asset', { modulePageId, assetId, assetType, title });

    return {
      assetId,
      assetUrl: `file://${assetFilePath}`,
      uploadedAt: new Date().toISOString(),
    };
  }

  async attachAsset(
    modulePageId: string,
    assetId: string,
    placement: string,
    order: number
  ): Promise<void> {
    const bundle = this.modules.get(modulePageId);
    if (!bundle) {
      throw createConnectorError(
        'lms',
        'attachAsset',
        'MODULE_NOT_FOUND',
        `Module not found: ${modulePageId}`,
        false
      );
    }

    // Add asset reference to main page
    const mainPage = bundle.pages[0];
    mainPage.assets.push({
      assetId,
      type: 'unknown', // Would be tracked from uploadAsset
      title: '',
      filename: `${assetId}`,
      placement,
      order,
    });

    bundle.updatedAt = new Date().toISOString();

    this.logger?.debug('FileSystem LMS: Attached asset', { modulePageId, assetId, placement, order });
  }

  async publish(modulePageId: string, publishedBy: string): Promise<PublishResult> {
    const bundle = this.modules.get(modulePageId);
    if (!bundle) {
      throw createConnectorError(
        'lms',
        'publish',
        'MODULE_NOT_FOUND',
        `Module not found: ${modulePageId}`,
        false
      );
    }

    bundle.status = 'published';
    bundle.publishedAt = new Date().toISOString();
    bundle.publishedBy = publishedBy;
    bundle.updatedAt = bundle.publishedAt;

    // Write final bundle JSON
    const modulePath = join(this.outputPath, bundle.vertical, modulePageId);
    const bundlePath = join(modulePath, 'module-bundle.json');
    await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2));

    this.logger?.info('FileSystem LMS: Published module', { modulePageId, bundlePath });

    return {
      modulePageId,
      moduleUrl: `file://${bundlePath}`,
      publishedAt: bundle.publishedAt,
    };
  }

  async getModuleStatus(modulePageId: string): Promise<{ status: string; url?: string }> {
    const bundle = this.modules.get(modulePageId);
    if (!bundle) {
      return { status: 'not_found' };
    }

    const modulePath = join(this.outputPath, bundle.vertical, modulePageId);
    return {
      status: bundle.status,
      url: `file://${modulePath}`,
    };
  }

  private getExtension(assetType: string, content: Buffer | string): string {
    if (typeof content === 'string' && content.startsWith('http')) {
      return '.url';
    }

    switch (assetType) {
      case 'document':
        return '.md';
      case 'video':
        return '.mp4';
      case 'quiz':
        return '.json';
      case 'interactive':
        return '.html';
      default:
        return '.bin';
    }
  }
}

/**
 * Generic LMS API Connector
 *
 * A configurable REST API client that can work with various LMS systems
 * by adapting endpoint paths and request/response formats.
 *
 * Supports common LMS platforms:
 * - Canvas LMS
 * - Moodle
 * - Blackboard
 * - Custom REST APIs
 */
export class GenericLmsConnector implements LmsConnector {
  private config: LmsConfig;
  private retryConfig: RetryConfig;
  private logger?: ConnectorLogger;
  private endpointConfig: LmsEndpointConfig;

  constructor(config: LmsConfig, logger?: ConnectorLogger) {
    this.config = config;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    this.logger = logger;
    this.endpointConfig = this.getEndpointConfig(config.provider);
  }

  /**
   * Get endpoint configuration based on LMS provider
   */
  private getEndpointConfig(provider: string): LmsEndpointConfig {
    const configs: Record<string, LmsEndpointConfig> = {
      canvas: {
        createModule: { method: 'POST', path: '/api/v1/courses/{courseId}/modules' },
        uploadAsset: { method: 'POST', path: '/api/v1/courses/{courseId}/files' },
        attachAsset: { method: 'POST', path: '/api/v1/courses/{courseId}/modules/{moduleId}/items' },
        publish: { method: 'PUT', path: '/api/v1/courses/{courseId}/modules/{moduleId}' },
        getStatus: { method: 'GET', path: '/api/v1/courses/{courseId}/modules/{moduleId}' },
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
      },
      moodle: {
        createModule: { method: 'POST', path: '/webservice/rest/server.php?wsfunction=core_course_create_modules' },
        uploadAsset: { method: 'POST', path: '/webservice/rest/server.php?wsfunction=core_files_upload' },
        attachAsset: { method: 'POST', path: '/webservice/rest/server.php?wsfunction=mod_resource_add_resource' },
        publish: { method: 'POST', path: '/webservice/rest/server.php?wsfunction=core_course_update_courses' },
        getStatus: { method: 'GET', path: '/webservice/rest/server.php?wsfunction=core_course_get_contents' },
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        authQueryParam: 'wstoken',
      },
      blackboard: {
        createModule: { method: 'POST', path: '/learn/api/public/v1/courses/{courseId}/contents' },
        uploadAsset: { method: 'POST', path: '/learn/api/public/v1/courses/{courseId}/contents/{contentId}/attachments' },
        attachAsset: { method: 'POST', path: '/learn/api/public/v1/courses/{courseId}/contents/{contentId}/children' },
        publish: { method: 'PATCH', path: '/learn/api/public/v1/courses/{courseId}/contents/{contentId}' },
        getStatus: { method: 'GET', path: '/learn/api/public/v1/courses/{courseId}/contents/{contentId}' },
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
      },
      generic: {
        createModule: { method: 'POST', path: '/api/modules' },
        uploadAsset: { method: 'POST', path: '/api/modules/{moduleId}/assets' },
        attachAsset: { method: 'POST', path: '/api/modules/{moduleId}/assets/{assetId}/attach' },
        publish: { method: 'POST', path: '/api/modules/{moduleId}/publish' },
        getStatus: { method: 'GET', path: '/api/modules/{moduleId}/status' },
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
      },
    };

    return configs[provider] || configs.generic;
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: EndpointSpec,
    pathParams: Record<string, string>,
    body?: Record<string, unknown> | FormData
  ): Promise<T> {
    if (!this.config.apiUrl) {
      throw createConnectorError('lms', 'apiRequest', 'CONFIG_ERROR', 'API URL not configured', false);
    }
    if (!this.config.apiKey) {
      throw createConnectorError('lms', 'apiRequest', 'CONFIG_ERROR', 'API key not configured', false);
    }

    // Build URL with path parameters
    let path = endpoint.path;
    for (const [key, value] of Object.entries(pathParams)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value));
    }

    let url = `${this.config.apiUrl}${path}`;

    // Add auth as query param if configured (e.g., Moodle)
    if (this.endpointConfig.authQueryParam) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${this.endpointConfig.authQueryParam}=${this.config.apiKey}`;
    }

    this.logger?.debug('LMS API request', { method: endpoint.method, url });

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Add auth header if not using query param
    if (!this.endpointConfig.authQueryParam) {
      headers[this.endpointConfig.authHeader] = `${this.endpointConfig.authPrefix}${this.config.apiKey}`;
    }

    // Set content type based on body type
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      const isRetryable = response.status >= 500 || response.status === 429;

      throw createConnectorError(
        'lms',
        path,
        `HTTP_${response.status}`,
        `LMS API request failed: ${error}`,
        isRetryable
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T;
    }

    return response.json() as T;
  }

  async createModule(
    title: string,
    description: string,
    metadata: Record<string, unknown>
  ): Promise<CreateModuleResult> {
    this.logger?.info('Creating LMS module', { title, provider: this.config.provider });

    const courseId = (metadata.courseId as string) || 'default';

    const response = await this.apiRequest<{
      id?: string;
      moduleId?: string;
      module_id?: string;
      url?: string;
      html_url?: string;
      created_at?: string;
      createdAt?: string;
    }>(
      this.endpointConfig.createModule,
      { courseId, moduleId: '' },
      {
        name: title,
        title,
        description,
        ...metadata,
      }
    );

    const modulePageId = response.id || response.moduleId || response.module_id || `lms-${Date.now()}`;
    const moduleUrl = response.url || response.html_url || `${this.config.apiUrl}/modules/${modulePageId}`;
    const createdAt = response.created_at || response.createdAt || new Date().toISOString();

    this.logger?.info('LMS module created', { modulePageId, moduleUrl });

    return {
      modulePageId,
      moduleUrl,
      createdAt,
    };
  }

  async uploadAsset(
    modulePageId: string,
    assetType: string,
    title: string,
    content: Buffer | string
  ): Promise<UploadAssetResult> {
    this.logger?.info('Uploading LMS asset', { modulePageId, assetType, title });

    const courseId = 'default'; // Would come from context in real implementation

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('name', title);
    formData.append('type', assetType);

    if (typeof content === 'string') {
      if (content.startsWith('http')) {
        // URL reference
        formData.append('url', content);
      } else {
        // Text content
        const blob = new Blob([content], { type: 'text/plain' });
        formData.append('file', blob, `${title}.txt`);
      }
    } else {
      // Binary content
      const blob = new Blob([content]);
      formData.append('file', blob, title);
    }

    const response = await this.apiRequest<{
      id?: string;
      assetId?: string;
      asset_id?: string;
      file_id?: string;
      url?: string;
      download_url?: string;
      created_at?: string;
    }>(
      this.endpointConfig.uploadAsset,
      { courseId, moduleId: modulePageId, contentId: modulePageId },
      formData
    );

    const assetId = response.id || response.assetId || response.asset_id || response.file_id || `asset-${Date.now()}`;
    const assetUrl = response.url || response.download_url || `${this.config.apiUrl}/files/${assetId}`;

    this.logger?.info('LMS asset uploaded', { assetId, assetUrl });

    return {
      assetId,
      assetUrl,
      uploadedAt: response.created_at || new Date().toISOString(),
    };
  }

  async attachAsset(
    modulePageId: string,
    assetId: string,
    placement: string,
    order: number
  ): Promise<void> {
    this.logger?.info('Attaching LMS asset', { modulePageId, assetId, placement, order });

    const courseId = 'default';

    await this.apiRequest<void>(
      this.endpointConfig.attachAsset,
      { courseId, moduleId: modulePageId, contentId: modulePageId, assetId },
      {
        asset_id: assetId,
        assetId,
        placement,
        position: order,
        order,
      }
    );

    this.logger?.info('LMS asset attached');
  }

  async publish(modulePageId: string, publishedBy: string): Promise<PublishResult> {
    this.logger?.info('Publishing LMS module', { modulePageId, publishedBy });

    const courseId = 'default';

    const response = await this.apiRequest<{
      id?: string;
      url?: string;
      html_url?: string;
      published_at?: string;
      publishedAt?: string;
    }>(
      this.endpointConfig.publish,
      { courseId, moduleId: modulePageId, contentId: modulePageId },
      {
        published: true,
        published_by: publishedBy,
        publishedBy,
      }
    );

    const moduleUrl = response.url || response.html_url || `${this.config.apiUrl}/modules/${modulePageId}`;
    const publishedAt = response.published_at || response.publishedAt || new Date().toISOString();

    this.logger?.info('LMS module published', { modulePageId, moduleUrl });

    return {
      modulePageId,
      moduleUrl,
      publishedAt,
    };
  }

  async getModuleStatus(modulePageId: string): Promise<{ status: string; url?: string }> {
    this.logger?.debug('Getting LMS module status', { modulePageId });

    const courseId = 'default';

    try {
      const response = await this.apiRequest<{
        id?: string;
        status?: string;
        published?: boolean;
        workflow_state?: string;
        url?: string;
        html_url?: string;
      }>(
        this.endpointConfig.getStatus,
        { courseId, moduleId: modulePageId, contentId: modulePageId }
      );

      let status = 'draft';
      if (response.published === true || response.workflow_state === 'active' || response.status === 'published') {
        status = 'published';
      }

      return {
        status,
        url: response.url || response.html_url,
      };
    } catch (error) {
      this.logger?.warn('Failed to get module status', { modulePageId, error });
      return { status: 'unknown' };
    }
  }
}

/**
 * LMS Endpoint configuration for different providers
 */
interface EndpointSpec {
  method: string;
  path: string;
}

interface LmsEndpointConfig {
  createModule: EndpointSpec;
  uploadAsset: EndpointSpec;
  attachAsset: EndpointSpec;
  publish: EndpointSpec;
  getStatus: EndpointSpec;
  authHeader: string;
  authPrefix: string;
  authQueryParam?: string;
}

/**
 * Create LMS connector based on configuration
 */
export function createLmsConnector(config: LmsConfig, logger?: ConnectorLogger): LmsConnector {
  switch (config.provider) {
    case 'filesystem':
      return new FileSystemLmsConnector(config.outputPath || './lms-output', logger);

    case 'canvas':
    case 'moodle':
    case 'blackboard':
    case 'generic':
      if (!config.apiUrl || !config.apiKey) {
        logger?.warn(`LMS provider ${config.provider} requires apiUrl and apiKey, using filesystem`);
        return new FileSystemLmsConnector(config.outputPath || './lms-output', logger);
      }
      return new GenericLmsConnector(config, logger);

    default:
      logger?.warn(`Unknown LMS provider: ${config.provider}, using filesystem`);
      return new FileSystemLmsConnector(config.outputPath || './lms-output', logger);
  }
}
