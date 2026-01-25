/**
 * Application Configuration
 * Centralized configuration management with environment variable validation
 */

import 'dotenv/config';

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  logLevel: string;
  api: {
    port: number;
    host: string;
    corsOrigins: string[];
  };
  database: {
    url: string;
    poolMin: number;
    poolMax: number;
  };
  redis: {
    url: string;
    password?: string;
  };
  storage: {
    provider: 'minio' | 's3' | 'gcs';
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
  };
  llm: {
    provider: 'openai';
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  notebookLm: {
    enabled: boolean;
    apiUrl: string;
    projectId: string;
    serviceAccountKeyPath?: string;
  };
  heygen: {
    enabled: boolean;
    apiKey: string;
    apiUrl: string;
    webhookUrl?: string;
    defaultAvatarId?: string;
    defaultVoiceId?: string;
  };
  lms: {
    provider: string;
    outputPath: string;
    apiUrl?: string;
    apiKey?: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    apiKeyHashSalt: string;
  };
  vectorStore: {
    provider: 'pgvector' | 'pinecone';
    pineconeApiKey?: string;
    pineconeEnvironment?: string;
  };
  features: {
    notebookLm: boolean;
    heygen: boolean;
    lmsPublish: boolean;
    chat: boolean;
    approvalRequired: boolean;
  };
  qualityGates: {
    minTotalWords: number;
    minWordsPerHeading: number;
    maxBulletRatio: number;
    requireDisclaimers: boolean;
  };
  observability: {
    otelEnabled: boolean;
    otelServiceName: string;
    otelEndpoint?: string;
    metricsEnabled: boolean;
    metricsPort: number;
  };
}

let config: AppConfig | null = null;

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}

function getEnvVarOptional(name: string): string | undefined {
  return process.env[name];
}

function getEnvVarInt(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (value === undefined && defaultValue !== undefined) {
    return defaultValue;
  }
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return parsed;
}

function getEnvVarFloat(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (value === undefined && defaultValue !== undefined) {
    return defaultValue;
  }
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

function getEnvVarBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

export function loadConfig(): AppConfig {
  if (config) {
    return config;
  }

  const env = getEnvVar('NODE_ENV', 'development') as AppConfig['env'];

  config = {
    env,
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
    api: {
      port: getEnvVarInt('API_PORT', 3000),
      host: getEnvVar('API_HOST', '0.0.0.0'),
      corsOrigins: getEnvVar('CORS_ORIGINS', 'http://localhost:3001').split(','),
    },
    database: {
      url: getEnvVar('DATABASE_URL'),
      poolMin: getEnvVarInt('DATABASE_POOL_MIN', 2),
      poolMax: getEnvVarInt('DATABASE_POOL_MAX', 10),
    },
    redis: {
      url: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
      password: getEnvVarOptional('REDIS_PASSWORD'),
    },
    storage: {
      provider: getEnvVar('STORAGE_PROVIDER', 'minio') as AppConfig['storage']['provider'],
      endpoint: getEnvVar('STORAGE_ENDPOINT', 'http://localhost:9000'),
      accessKey: getEnvVar('STORAGE_ACCESS_KEY', 'minioadmin'),
      secretKey: getEnvVar('STORAGE_SECRET_KEY', 'minioadmin'),
      bucket: getEnvVar('STORAGE_BUCKET', 'learnglobal-assets'),
      region: getEnvVar('STORAGE_REGION', 'us-east-1'),
    },
    llm: {
      provider: 'openai',
      apiKey: getEnvVar('OPENAI_API_KEY', 'sk-placeholder'),
      model: getEnvVar('OPENAI_MODEL', 'gpt-4-turbo-preview'),
      maxTokens: getEnvVarInt('OPENAI_MAX_TOKENS', 4096),
      temperature: getEnvVarFloat('OPENAI_TEMPERATURE', 0.3),
    },
    notebookLm: {
      enabled: getEnvVarBool('NOTEBOOKLM_ENABLED', false),
      apiUrl: getEnvVar('NOTEBOOKLM_API_URL', 'https://notebooklm.googleapis.com/v1'),
      projectId: getEnvVar('NOTEBOOKLM_PROJECT_ID', ''),
      serviceAccountKeyPath: getEnvVarOptional('NOTEBOOKLM_SERVICE_ACCOUNT_KEY'),
    },
    heygen: {
      enabled: getEnvVarBool('HEYGEN_ENABLED', false),
      apiKey: getEnvVar('HEYGEN_API_KEY', ''),
      apiUrl: getEnvVar('HEYGEN_API_URL', 'https://api.heygen.com/v2'),
      webhookUrl: getEnvVarOptional('HEYGEN_WEBHOOK_URL'),
      defaultAvatarId: getEnvVarOptional('HEYGEN_DEFAULT_AVATAR_ID'),
      defaultVoiceId: getEnvVarOptional('HEYGEN_DEFAULT_VOICE_ID'),
    },
    lms: {
      provider: getEnvVar('LMS_PROVIDER', 'filesystem'),
      outputPath: getEnvVar('LMS_OUTPUT_PATH', './lms-output'),
      apiUrl: getEnvVarOptional('LMS_API_URL'),
      apiKey: getEnvVarOptional('LMS_API_KEY'),
    },
    auth: {
      jwtSecret: getEnvVar('JWT_SECRET', 'dev-secret-change-in-production'),
      jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
      apiKeyHashSalt: getEnvVar('API_KEY_HASH_SALT', 'dev-salt'),
    },
    vectorStore: {
      provider: getEnvVar('VECTOR_STORE_PROVIDER', 'pgvector') as AppConfig['vectorStore']['provider'],
      pineconeApiKey: getEnvVarOptional('PINECONE_API_KEY'),
      pineconeEnvironment: getEnvVarOptional('PINECONE_ENVIRONMENT'),
    },
    features: {
      notebookLm: getEnvVarBool('FEATURE_NOTEBOOKLM', false),
      heygen: getEnvVarBool('FEATURE_HEYGEN', false),
      lmsPublish: getEnvVarBool('FEATURE_LMS_PUBLISH', true),
      chat: getEnvVarBool('FEATURE_CHAT', true),
      approvalRequired: getEnvVarBool('FEATURE_APPROVAL_REQUIRED', false),
    },
    qualityGates: {
      minTotalWords: getEnvVarInt('QA_MIN_TOTAL_WORDS', 5000),
      minWordsPerHeading: getEnvVarInt('QA_MIN_WORDS_PER_HEADING', 500),
      maxBulletRatio: getEnvVarFloat('QA_MAX_BULLET_RATIO', 0.08),
      requireDisclaimers: getEnvVarBool('QA_REQUIRE_DISCLAIMERS', true),
    },
    observability: {
      otelEnabled: getEnvVarBool('OTEL_ENABLED', false),
      otelServiceName: getEnvVar('OTEL_SERVICE_NAME', 'learnglobal-api'),
      otelEndpoint: getEnvVarOptional('OTEL_EXPORTER_OTLP_ENDPOINT'),
      metricsEnabled: getEnvVarBool('METRICS_ENABLED', true),
      metricsPort: getEnvVarInt('METRICS_PORT', 9090),
    },
  };

  return config;
}

export function getConfig(): AppConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

// For testing - allows resetting config
export function resetConfig(): void {
  config = null;
}
