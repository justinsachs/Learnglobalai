/**
 * HeyGenPackage - Complete package for HeyGen video generation
 * Includes script, scene breakdown, pronunciation guide, and configuration
 */

import type { ModuleId, Version, Timestamp, Hash } from './base.js';

/**
 * On-screen text cue
 */
export interface OnScreenTextCue {
  /** Cue ID */
  id: string;
  /** When to show (time in script or scene number) */
  timing: string;
  /** Text to display */
  text: string;
  /** Position on screen */
  position: 'top' | 'bottom' | 'center' | 'lower_third';
  /** Duration in seconds */
  durationSeconds: number;
  /** Style */
  style?: 'title' | 'subtitle' | 'bullet' | 'highlight' | 'callout';
  /** Animation */
  animation?: 'fade' | 'slide' | 'pop' | 'none';
}

/**
 * Scene in the video
 */
export interface Scene {
  /** Scene number */
  sceneNumber: number;
  /** Scene title/description */
  title: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** Narration script for this scene */
  narrationScript: string;
  /** Visual description */
  visualDescription: string;
  /** Avatar action */
  avatarAction: 'talking' | 'gesturing' | 'pointing' | 'listening' | 'thinking';
  /** Background */
  background?: string;
  /** On-screen text cues for this scene */
  onScreenTextCues: OnScreenTextCue[];
  /** Transition to next scene */
  transitionOut?: 'cut' | 'fade' | 'dissolve' | 'wipe';
  /** B-roll or overlay requirements */
  overlayRequirements?: string;
  /** Notes for production */
  productionNotes?: string;
}

/**
 * Pronunciation guide entry
 */
export interface PronunciationEntry {
  /** The term */
  term: string;
  /** Phonetic pronunciation */
  phonetic: string;
  /** IPA pronunciation (if available) */
  ipa?: string;
  /** Audio reference URL (if available) */
  audioRef?: string;
  /** Usage notes */
  notes?: string;
}

/**
 * Avatar configuration
 */
export interface AvatarConfig {
  /** Avatar ID from HeyGen */
  avatarId?: string;
  /** Avatar style preference */
  style: string;
  /** Voice ID */
  voiceId?: string;
  /** Voice speed (0.5 - 2.0) */
  voiceSpeed: number;
  /** Voice pitch adjustment */
  voicePitch?: number;
  /** Outfit/appearance preference */
  appearance?: string;
  /** Background preference */
  backgroundPreference?: string;
}

/**
 * Video settings
 */
export interface VideoSettings {
  /** Output resolution */
  resolution: '720p' | '1080p' | '4k';
  /** Aspect ratio */
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  /** Frame rate */
  frameRate: 24 | 30 | 60;
  /** Output format */
  format: 'mp4' | 'mov' | 'webm';
  /** Quality preset */
  quality: 'draft' | 'standard' | 'high';
  /** Include captions */
  includeCaptions: boolean;
  /** Caption style */
  captionStyle?: 'bottom' | 'dynamic' | 'karaoke';
}

/**
 * Template reference (if using HeyGen templates)
 */
export interface TemplateConfig {
  /** Template ID */
  templateId: string;
  /** Template name */
  templateName: string;
  /** Variable mappings */
  variables: Record<string, string>;
  /** Custom overrides */
  overrides?: Record<string, unknown>;
}

/**
 * Complete HeyGen Package
 */
export interface HeyGenPackage {
  /** Module ID */
  moduleId: ModuleId;

  /** Version */
  version: Version;

  /** Generation timestamp */
  generatedAt: Timestamp;

  /** Run ID */
  runId: string;

  /** Video title */
  title: string;

  /** Video description */
  description: string;

  /** Complete narration script (full text) */
  narrationScript: string;

  /** Scene-by-scene breakdown */
  sceneBreakdown: Scene[];

  /** Pronunciation guide */
  pronunciationGuide: PronunciationEntry[];

  /** All on-screen text cues (for easy reference) */
  onScreenTextCues: OnScreenTextCue[];

  /** Avatar configuration */
  avatarConfig: AvatarConfig;

  /** Video settings */
  videoSettings: VideoSettings;

  /** Template configuration (if using template) */
  templateConfig?: TemplateConfig;

  /** Total estimated duration in seconds */
  estimatedDurationSeconds: number;

  /** Word count of narration */
  narrationWordCount: number;

  /** MediaPromptPack hash this was derived from */
  mediaPromptPackHash: Hash;

  /** SourcePack hash */
  sourcePackHash: Hash;

  /** ModuleSpec hash */
  moduleSpecHash: Hash;

  /** Production notes */
  productionNotes?: string;

  /** Accessibility features */
  accessibility?: {
    transcriptIncluded: boolean;
    closedCaptionsIncluded: boolean;
    audioDescriptionIncluded: boolean;
  };
}

/**
 * HeyGen API request payload (simplified)
 */
export interface HeyGenApiRequest {
  /** Video title */
  title: string;
  /** Avatar ID */
  avatar_id: string;
  /** Voice ID */
  voice_id: string;
  /** Script text */
  script: string;
  /** Background */
  background?: string;
  /** Video settings */
  settings: {
    resolution: string;
    aspect_ratio: string;
  };
  /** Template ID if using template */
  template_id?: string;
  /** Template variables */
  template_variables?: Record<string, string>;
  /** Webhook URL for completion notification */
  webhook_url?: string;
}

/**
 * HeyGen API response
 */
export interface HeyGenApiResponse {
  /** Job ID */
  job_id: string;
  /** Status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Video URL (when completed) */
  video_url?: string;
  /** Error message (if failed) */
  error?: string;
  /** Estimated completion time */
  estimated_completion?: string;
}
