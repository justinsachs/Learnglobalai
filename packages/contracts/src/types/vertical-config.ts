/**
 * Vertical/Brand configuration types
 * Allows the platform to support multiple brands with different policies
 */

import type { Vertical, AudienceRole } from './base.js';
import type { ContentConstraints, SafetyBoundaries, MediaPreferences } from './module-spec.js';
import type { ChatPolicy } from './chat.js';

/**
 * Prompt template configuration
 */
export interface PromptTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template version */
  version: string;
  /** Template purpose */
  purpose: 'outline' | 'sourcepack' | 'qa' | 'media_prompt_pack' | 'heygen_script' | 'chat_system';
  /** Template content (with placeholders) */
  content: string;
  /** Required variables */
  requiredVariables: string[];
  /** Optional variables with defaults */
  optionalVariables: Record<string, string>;
  /** Last updated */
  updatedAt: string;
}

/**
 * Branding configuration
 */
export interface BrandingConfig {
  /** Brand name */
  name: string;
  /** Logo URL */
  logoUrl?: string;
  /** Primary color */
  primaryColor: string;
  /** Secondary color */
  secondaryColor: string;
  /** Accent color */
  accentColor: string;
  /** Font family */
  fontFamily?: string;
  /** Tagline */
  tagline?: string;
  /** Footer text */
  footerText?: string;
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  /** Minimum total words */
  minTotalWords: number;
  /** Minimum words per major heading */
  minWordsPerMajorHeading: number;
  /** Maximum bullet ratio */
  maxBulletRatio: number;
  /** Require disclaimers */
  requireDisclaimers: boolean;
  /** Require all artifacts */
  requireAllArtifacts: boolean;
  /** Require standards coverage */
  requireStandardsCoverage: boolean;
  /** Allow not-applicable standards */
  allowNotApplicableStandards: boolean;
  /** Strict mode (warnings as errors) */
  strictMode: boolean;
  /** Custom validation rules */
  customRules?: Array<{
    name: string;
    description: string;
    validationFn: string; // Serialized function or rule reference
  }>;
}

/**
 * Media configuration for a vertical
 */
export interface VerticalMediaConfig {
  /** Default video duration target (minutes) */
  defaultVideoDurationMinutes: number;
  /** Default avatar style */
  defaultAvatarStyle: string;
  /** Default audio tone */
  defaultAudioTone: string;
  /** Default infographic style */
  defaultInfographicStyle: string;
  /** HeyGen avatar ID */
  heygenAvatarId?: string;
  /** HeyGen voice ID */
  heygenVoiceId?: string;
  /** Video resolution */
  videoResolution: '720p' | '1080p' | '4k';
  /** Video aspect ratio */
  videoAspectRatio: '16:9' | '9:16' | '1:1';
  /** Background music preference */
  backgroundMusic: 'none' | 'subtle' | 'moderate';
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** NotebookLM enabled */
  notebookLmEnabled: boolean;
  /** NotebookLM project ID */
  notebookLmProjectId?: string;
  /** HeyGen enabled */
  heygenEnabled: boolean;
  /** LMS provider */
  lmsProvider: string;
  /** LMS-specific config */
  lmsConfig?: Record<string, unknown>;
  /** Chat enabled */
  chatEnabled: boolean;
  /** External integrations */
  externalIntegrations?: Array<{
    name: string;
    type: string;
    config: Record<string, unknown>;
  }>;
}

/**
 * Complete vertical configuration
 */
export interface VerticalConfig {
  /** Vertical identifier */
  vertical: Vertical;

  /** Display name */
  displayName: string;

  /** Description */
  description: string;

  /** Branding */
  branding: BrandingConfig;

  /** Default target audience roles */
  defaultAudienceRoles: AudienceRole[];

  /** Default content constraints */
  defaultConstraints: ContentConstraints;

  /** Default safety boundaries */
  defaultSafetyBoundaries: SafetyBoundaries;

  /** Default media preferences */
  defaultMediaPreferences: MediaPreferences;

  /** Quality gate configuration */
  qualityGates: QualityGateConfig;

  /** Media configuration */
  mediaConfig: VerticalMediaConfig;

  /** Integration configuration */
  integrations: IntegrationConfig;

  /** Prompt templates */
  promptTemplates: PromptTemplate[];

  /** Chat policy template */
  defaultChatPolicy: Partial<ChatPolicy>;

  /** Required disclaimers */
  requiredDisclaimers: string[];

  /** Prohibited topics */
  prohibitedTopics: string[];

  /** Escalation contacts */
  escalationContacts?: Array<{
    name: string;
    role: string;
    email: string;
  }>;

  /** Feature flags */
  featureFlags: Record<string, boolean>;

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;

  /** Active status */
  active: boolean;
}

/**
 * Vertical configuration input (for creation/update)
 */
export interface VerticalConfigInput {
  vertical: Vertical;
  displayName: string;
  description: string;
  branding: BrandingConfig;
  defaultAudienceRoles?: AudienceRole[];
  defaultConstraints?: Partial<ContentConstraints>;
  defaultSafetyBoundaries?: Partial<SafetyBoundaries>;
  defaultMediaPreferences?: Partial<MediaPreferences>;
  qualityGates?: Partial<QualityGateConfig>;
  mediaConfig?: Partial<VerticalMediaConfig>;
  integrations?: Partial<IntegrationConfig>;
  promptTemplates?: PromptTemplate[];
  defaultChatPolicy?: Partial<ChatPolicy>;
  requiredDisclaimers?: string[];
  prohibitedTopics?: string[];
  featureFlags?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
}

/**
 * Default vertical configurations
 */
export const DEFAULT_VERTICALS: Record<string, Partial<VerticalConfig>> = {
  medviro: {
    vertical: 'medviro',
    displayName: 'MedViro',
    description: 'Medical device and healthcare compliance training',
    branding: {
      name: 'MedViro',
      primaryColor: '#1a73e8',
      secondaryColor: '#4285f4',
      accentColor: '#34a853',
    },
    defaultAudienceRoles: ['technician', 'supervisor', 'compliance-officer'],
    requiredDisclaimers: [
      'This training material is for educational purposes only and does not constitute medical advice.',
      'Always follow your organization\'s specific protocols and consult qualified professionals for medical decisions.',
    ],
    prohibitedTopics: [
      'specific patient diagnoses',
      'prescription recommendations',
      'off-label device usage',
    ],
  },
  clearclaims: {
    vertical: 'clearclaims',
    displayName: 'ClearClaims',
    description: 'Insurance claims processing and compliance training',
    branding: {
      name: 'ClearClaims',
      primaryColor: '#2962ff',
      secondaryColor: '#448aff',
      accentColor: '#00c853',
    },
    defaultAudienceRoles: ['administrator', 'customer-service', 'supervisor'],
    requiredDisclaimers: [
      'This training is for educational purposes and does not constitute legal or financial advice.',
      'Claims decisions must follow your organization\'s policies and applicable regulations.',
    ],
  },
  'response-roofing': {
    vertical: 'response-roofing',
    displayName: 'Response Roofing',
    description: 'Roofing industry safety and operations training',
    branding: {
      name: 'Response Roofing',
      primaryColor: '#ff6d00',
      secondaryColor: '#ff9100',
      accentColor: '#00b8d4',
    },
    defaultAudienceRoles: ['technician', 'field-worker', 'supervisor'],
    requiredDisclaimers: [
      'Safety training does not replace proper supervision and site-specific safety assessments.',
      'Always follow OSHA regulations and your organization\'s safety protocols.',
    ],
  },
};
