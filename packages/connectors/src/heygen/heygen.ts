/**
 * HeyGen Video Generation Connector
 * Supports both real API and mock implementation
 */

import {
  type ConnectorLogger,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  createConnectorError,
} from '../types.js';

export interface HeyGenConfig {
  apiKey: string;
  apiUrl: string;
  webhookUrl?: string;
  defaultAvatarId?: string;
  defaultVoiceId?: string;
  enabled: boolean;
  retryConfig?: RetryConfig;
}

export interface CreateVideoOptions {
  resolution?: '720p' | '1080p' | '4k';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  background?: string;
  title?: string;
}

export interface CreateVideoResult {
  jobId: string;
  status: 'pending' | 'processing';
  estimatedCompletionSeconds?: number;
}

export interface PollStatusResult {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
}

/**
 * HeyGen Connector Interface
 */
export interface HeyGenConnector {
  createVideo(script: string, avatarId: string, voiceId: string, options?: CreateVideoOptions): Promise<CreateVideoResult>;
  pollStatus(jobId: string): Promise<PollStatusResult>;
  listAvatars(): Promise<Array<{ avatarId: string; name: string }>>;
  listVoices(): Promise<Array<{ voiceId: string; name: string; language: string }>>;
}

/**
 * Mock HeyGen Connector for development/testing
 */
export class MockHeyGenConnector implements HeyGenConnector {
  private jobs: Map<string, { status: string; createdAt: number; script: string }> = new Map();
  private logger?: ConnectorLogger;

  constructor(logger?: ConnectorLogger) {
    this.logger = logger;
  }

  async createVideo(
    script: string,
    avatarId: string,
    voiceId: string,
    options?: CreateVideoOptions
  ): Promise<CreateVideoResult> {
    const jobId = `hg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.jobs.set(jobId, {
      status: 'processing',
      createdAt: Date.now(),
      script,
    });

    this.logger?.info('Mock: Created video job', {
      jobId,
      avatarId,
      voiceId,
      scriptLength: script.length,
      options,
    });

    return {
      jobId,
      status: 'processing',
      estimatedCompletionSeconds: 60,
    };
  }

  async pollStatus(jobId: string): Promise<PollStatusResult> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw createConnectorError(
        'heygen',
        'pollStatus',
        'JOB_NOT_FOUND',
        `Job not found: ${jobId}`,
        false
      );
    }

    // Simulate processing time (complete after 5 seconds in mock)
    const elapsed = Date.now() - job.createdAt;
    const completed = elapsed > 5000;

    if (completed && job.status !== 'completed') {
      job.status = 'completed';
    }

    const progress = Math.min(100, Math.floor((elapsed / 5000) * 100));

    this.logger?.debug('Mock: Polled status', { jobId, status: job.status, progress });

    return {
      jobId,
      status: job.status as PollStatusResult['status'],
      progress,
      ...(completed && {
        videoUrl: `https://mock-heygen.example.com/videos/${jobId}.mp4`,
        thumbnailUrl: `https://mock-heygen.example.com/thumbnails/${jobId}.jpg`,
        duration: 120,
      }),
    };
  }

  async listAvatars(): Promise<Array<{ avatarId: string; name: string }>> {
    return [
      { avatarId: 'avatar-professional-1', name: 'Professional Male' },
      { avatarId: 'avatar-professional-2', name: 'Professional Female' },
      { avatarId: 'avatar-casual-1', name: 'Casual Male' },
      { avatarId: 'avatar-casual-2', name: 'Casual Female' },
    ];
  }

  async listVoices(): Promise<Array<{ voiceId: string; name: string; language: string }>> {
    return [
      { voiceId: 'voice-en-us-1', name: 'American English (Male)', language: 'en-US' },
      { voiceId: 'voice-en-us-2', name: 'American English (Female)', language: 'en-US' },
      { voiceId: 'voice-en-gb-1', name: 'British English (Male)', language: 'en-GB' },
      { voiceId: 'voice-en-gb-2', name: 'British English (Female)', language: 'en-GB' },
    ];
  }
}

/**
 * Real HeyGen Connector
 */
export class RealHeyGenConnector implements HeyGenConnector {
  private config: HeyGenConfig;
  private retryConfig: RetryConfig;
  private logger?: ConnectorLogger;

  constructor(config: HeyGenConfig, logger?: ConnectorLogger) {
    this.config = config;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    this.logger = logger;
  }

  async createVideo(
    script: string,
    avatarId: string,
    voiceId: string,
    options?: CreateVideoOptions
  ): Promise<CreateVideoResult> {
    return withRetry(
      async () => {
        this.logger?.info('Creating video via HeyGen API', {
          avatarId,
          voiceId,
          scriptLength: script.length,
        });

        const response = await fetch(`${this.config.apiUrl}/video/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.config.apiKey,
          },
          body: JSON.stringify({
            video_inputs: [
              {
                character: {
                  type: 'avatar',
                  avatar_id: avatarId,
                  avatar_style: 'normal',
                },
                voice: {
                  type: 'text',
                  input_text: script,
                  voice_id: voiceId,
                },
                background: {
                  type: 'color',
                  value: options?.background || '#ffffff',
                },
              },
            ],
            dimension: {
              width: options?.resolution === '4k' ? 3840 : options?.resolution === '720p' ? 1280 : 1920,
              height: options?.resolution === '4k' ? 2160 : options?.resolution === '720p' ? 720 : 1080,
            },
            aspect_ratio: options?.aspectRatio || '16:9',
            ...(this.config.webhookUrl && { callback_url: this.config.webhookUrl }),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw createConnectorError(
            'heygen',
            'createVideo',
            `HTTP_${response.status}`,
            errorData.message || `HeyGen API error: ${response.status}`,
            response.status >= 500 || response.status === 429,
            errorData
          );
        }

        const data = await response.json();

        return {
          jobId: data.data?.video_id || data.video_id,
          status: 'processing',
          estimatedCompletionSeconds: data.data?.estimated_time,
        };
      },
      this.retryConfig,
      this.logger,
      'createVideo'
    );
  }

  async pollStatus(jobId: string): Promise<PollStatusResult> {
    return withRetry(
      async () => {
        this.logger?.debug('Polling HeyGen job status', { jobId });

        const response = await fetch(`${this.config.apiUrl}/video_status.get?video_id=${jobId}`, {
          method: 'GET',
          headers: {
            'X-Api-Key': this.config.apiKey,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw createConnectorError(
            'heygen',
            'pollStatus',
            `HTTP_${response.status}`,
            errorData.message || `HeyGen API error: ${response.status}`,
            response.status >= 500 || response.status === 429,
            errorData
          );
        }

        const data = await response.json();
        const statusData = data.data || data;

        return {
          jobId,
          status: this.mapStatus(statusData.status),
          progress: statusData.progress,
          videoUrl: statusData.video_url,
          thumbnailUrl: statusData.thumbnail_url,
          duration: statusData.duration,
          error: statusData.error,
        };
      },
      this.retryConfig,
      this.logger,
      'pollStatus'
    );
  }

  private mapStatus(apiStatus: string): PollStatusResult['status'] {
    const statusMap: Record<string, PollStatusResult['status']> = {
      pending: 'pending',
      processing: 'processing',
      completed: 'completed',
      failed: 'failed',
      success: 'completed',
      error: 'failed',
    };
    return statusMap[apiStatus?.toLowerCase()] || 'processing';
  }

  async listAvatars(): Promise<Array<{ avatarId: string; name: string }>> {
    return withRetry(
      async () => {
        const response = await fetch(`${this.config.apiUrl}/avatar.list`, {
          method: 'GET',
          headers: {
            'X-Api-Key': this.config.apiKey,
          },
        });

        if (!response.ok) {
          throw createConnectorError(
            'heygen',
            'listAvatars',
            `HTTP_${response.status}`,
            'Failed to list avatars',
            response.status >= 500
          );
        }

        const data = await response.json();
        return (data.data?.avatars || []).map((a: any) => ({
          avatarId: a.avatar_id,
          name: a.avatar_name,
        }));
      },
      this.retryConfig,
      this.logger,
      'listAvatars'
    );
  }

  async listVoices(): Promise<Array<{ voiceId: string; name: string; language: string }>> {
    return withRetry(
      async () => {
        const response = await fetch(`${this.config.apiUrl}/voice.list`, {
          method: 'GET',
          headers: {
            'X-Api-Key': this.config.apiKey,
          },
        });

        if (!response.ok) {
          throw createConnectorError(
            'heygen',
            'listVoices',
            `HTTP_${response.status}`,
            'Failed to list voices',
            response.status >= 500
          );
        }

        const data = await response.json();
        return (data.data?.voices || []).map((v: any) => ({
          voiceId: v.voice_id,
          name: v.display_name || v.name,
          language: v.language,
        }));
      },
      this.retryConfig,
      this.logger,
      'listVoices'
    );
  }
}

/**
 * Create HeyGen connector based on configuration
 */
export function createHeyGenConnector(
  config: HeyGenConfig,
  logger?: ConnectorLogger
): HeyGenConnector {
  if (!config.enabled || !config.apiKey) {
    logger?.info('HeyGen not enabled or no API key, using mock connector');
    return new MockHeyGenConnector(logger);
  }

  return new RealHeyGenConnector(config, logger);
}
