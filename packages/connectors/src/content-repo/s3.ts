/**
 * S3/MinIO Content Repository Connector
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'stream';
import {
  type ConnectorLogger,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  createConnectorError,
} from '../types.js';

export interface S3ContentRepoConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
  retryConfig?: RetryConfig;
}

export interface PutObjectResult {
  uri: string;
  etag: string;
  versionId?: string;
}

export interface GetObjectResult {
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
  lastModified?: Date;
  versionId?: string;
}

export interface ListObjectsResult {
  objects: Array<{
    key: string;
    size: number;
    lastModified: Date;
    etag: string;
  }>;
  isTruncated: boolean;
  continuationToken?: string;
}

/**
 * S3/MinIO Content Repository Connector
 */
export class S3ContentRepo {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;
  private retryConfig: RetryConfig;
  private logger?: ConnectorLogger;

  constructor(config: S3ContentRepoConfig, logger?: ConnectorLogger) {
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    this.logger = logger;

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  /**
   * Put an object to the repository
   */
  async putObject(
    key: string,
    body: Buffer | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<PutObjectResult> {
    this.logger?.debug('Putting object', { key, contentType, size: body.length });

    return withRetry(
      async () => {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: typeof body === 'string' ? Buffer.from(body) : body,
          ContentType: contentType,
          Metadata: metadata,
        });

        const result = await this.client.send(command);

        const uri = `s3://${this.bucket}/${key}`;
        this.logger?.info('Object stored', { key, uri, etag: result.ETag });

        return {
          uri,
          etag: result.ETag || '',
          versionId: result.VersionId,
        };
      },
      this.retryConfig,
      this.logger,
      `putObject:${key}`
    );
  }

  /**
   * Get an object from the repository
   */
  async getObject(key: string, versionId?: string): Promise<GetObjectResult> {
    this.logger?.debug('Getting object', { key, versionId });

    return withRetry(
      async () => {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          VersionId: versionId,
        });

        const result = await this.client.send(command);

        if (!result.Body) {
          throw createConnectorError(
            'content-repo',
            'getObject',
            'NO_BODY',
            `No body returned for key: ${key}`,
            false
          );
        }

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of result.Body as Readable) {
          chunks.push(Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);

        return {
          body,
          contentType: result.ContentType || 'application/octet-stream',
          metadata: (result.Metadata as Record<string, string>) || {},
          lastModified: result.LastModified,
          versionId: result.VersionId,
        };
      },
      this.retryConfig,
      this.logger,
      `getObject:${key}`
    );
  }

  /**
   * List objects with a prefix
   */
  async listObjects(
    prefix: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<ListObjectsResult> {
    this.logger?.debug('Listing objects', { prefix, maxKeys });

    return withRetry(
      async () => {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
          ContinuationToken: continuationToken,
        });

        const result = await this.client.send(command);

        return {
          objects: (result.Contents || []).map((obj) => ({
            key: obj.Key || '',
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
            etag: obj.ETag || '',
          })),
          isTruncated: result.IsTruncated || false,
          continuationToken: result.NextContinuationToken,
        };
      },
      this.retryConfig,
      this.logger,
      `listObjects:${prefix}`
    );
  }

  /**
   * Delete an object
   */
  async deleteObject(key: string, versionId?: string): Promise<void> {
    this.logger?.debug('Deleting object', { key, versionId });

    return withRetry(
      async () => {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
          VersionId: versionId,
        });

        await this.client.send(command);
        this.logger?.info('Object deleted', { key });
      },
      this.retryConfig,
      this.logger,
      `deleteObject:${key}`
    );
  }

  /**
   * Check if an object exists
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate a versioned path for artifacts
   */
  static generatePath(
    vertical: string,
    moduleId: string,
    version: string,
    runId: string,
    filename: string
  ): string {
    return `${vertical}/${moduleId}/${version}/${runId}/${filename}`;
  }
}
