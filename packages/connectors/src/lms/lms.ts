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
 * Generic LMS API Connector (placeholder for real integrations)
 */
export class GenericLmsConnector implements LmsConnector {
  private config: LmsConfig;
  private retryConfig: RetryConfig;
  private logger?: ConnectorLogger;

  constructor(config: LmsConfig, logger?: ConnectorLogger) {
    this.config = config;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    this.logger = logger;
  }

  async createModule(
    title: string,
    description: string,
    metadata: Record<string, unknown>
  ): Promise<CreateModuleResult> {
    throw createConnectorError(
      'lms',
      'createModule',
      'NOT_IMPLEMENTED',
      `LMS provider ${this.config.provider} not implemented`,
      false
    );
  }

  async uploadAsset(
    modulePageId: string,
    assetType: string,
    title: string,
    content: Buffer | string
  ): Promise<UploadAssetResult> {
    throw createConnectorError(
      'lms',
      'uploadAsset',
      'NOT_IMPLEMENTED',
      `LMS provider ${this.config.provider} not implemented`,
      false
    );
  }

  async attachAsset(
    modulePageId: string,
    assetId: string,
    placement: string,
    order: number
  ): Promise<void> {
    throw createConnectorError(
      'lms',
      'attachAsset',
      'NOT_IMPLEMENTED',
      `LMS provider ${this.config.provider} not implemented`,
      false
    );
  }

  async publish(modulePageId: string, publishedBy: string): Promise<PublishResult> {
    throw createConnectorError(
      'lms',
      'publish',
      'NOT_IMPLEMENTED',
      `LMS provider ${this.config.provider} not implemented`,
      false
    );
  }

  async getModuleStatus(modulePageId: string): Promise<{ status: string; url?: string }> {
    throw createConnectorError(
      'lms',
      'getModuleStatus',
      'NOT_IMPLEMENTED',
      `LMS provider ${this.config.provider} not implemented`,
      false
    );
  }
}

/**
 * Create LMS connector based on configuration
 */
export function createLmsConnector(config: LmsConfig, logger?: ConnectorLogger): LmsConnector {
  switch (config.provider) {
    case 'filesystem':
      return new FileSystemLmsConnector(config.outputPath || './lms-output', logger);
    default:
      logger?.warn(`Unknown LMS provider: ${config.provider}, using filesystem`);
      return new FileSystemLmsConnector(config.outputPath || './lms-output', logger);
  }
}
