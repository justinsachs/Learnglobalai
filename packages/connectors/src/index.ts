/**
 * @learnglobal/connectors
 *
 * MCP-style tool connectors for LearnGlobal.ai
 */

// Types
export * from './types.js';

// Content Repository
export { S3ContentRepo, type S3ContentRepoConfig } from './content-repo/s3.js';

// NotebookLM
export {
  createNotebookLmConnector,
  MockNotebookLmConnector,
  RealNotebookLmConnector,
  type NotebookLmConfig,
  type NotebookLmConnector,
} from './notebooklm/notebooklm.js';

// HeyGen
export {
  createHeyGenConnector,
  MockHeyGenConnector,
  RealHeyGenConnector,
  type HeyGenConfig,
  type HeyGenConnector,
} from './heygen/heygen.js';

// LMS
export {
  createLmsConnector,
  FileSystemLmsConnector,
  GenericLmsConnector,
  type LmsConfig,
  type LmsConnector,
  type LmsModuleBundle,
} from './lms/lms.js';

// Factory function to create all connectors
export interface ConnectorFactoryConfig {
  contentRepo: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  notebookLm?: {
    enabled: boolean;
    apiUrl: string;
    projectId: string;
  };
  heygen?: {
    enabled: boolean;
    apiKey: string;
    apiUrl: string;
  };
  lms: {
    provider: string;
    outputPath?: string;
  };
}

import { S3ContentRepo } from './content-repo/s3.js';
import { createNotebookLmConnector } from './notebooklm/notebooklm.js';
import { createHeyGenConnector } from './heygen/heygen.js';
import { createLmsConnector } from './lms/lms.js';
import type { ConnectorLogger } from './types.js';

export interface Connectors {
  contentRepo: S3ContentRepo;
  notebookLm?: ReturnType<typeof createNotebookLmConnector>;
  heygen?: ReturnType<typeof createHeyGenConnector>;
  lms: ReturnType<typeof createLmsConnector>;
}

/**
 * Create all connectors from configuration
 */
export function createConnectors(config: ConnectorFactoryConfig, logger?: ConnectorLogger): Connectors {
  return {
    contentRepo: new S3ContentRepo(
      {
        endpoint: config.contentRepo.endpoint,
        region: config.contentRepo.region,
        accessKeyId: config.contentRepo.accessKeyId,
        secretAccessKey: config.contentRepo.secretAccessKey,
        bucket: config.contentRepo.bucket,
        forcePathStyle: true,
      },
      logger
    ),
    notebookLm: config.notebookLm
      ? createNotebookLmConnector(
          {
            enabled: config.notebookLm.enabled,
            apiUrl: config.notebookLm.apiUrl,
            projectId: config.notebookLm.projectId,
          },
          logger
        )
      : undefined,
    heygen: config.heygen
      ? createHeyGenConnector(
          {
            enabled: config.heygen.enabled,
            apiKey: config.heygen.apiKey,
            apiUrl: config.heygen.apiUrl,
          },
          logger
        )
      : undefined,
    lms: createLmsConnector(config.lms, logger),
  };
}
