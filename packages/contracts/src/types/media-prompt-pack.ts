/**
 * MediaPromptPack - Combined prompts for NotebookLM audio/video/infographic generation
 * This is a single document that provides generation guidance for all media types
 */

import type { ModuleId, Version, Timestamp, Hash } from './base.js';

/**
 * Shot specification for video
 */
export interface VideoShot {
  /** Shot number */
  shotNumber: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Description of what happens */
  description: string;
  /** On-screen text to display */
  onScreenText?: string;
  /** Visual type */
  visualType: 'talking_head' | 'b_roll' | 'graphic' | 'animation' | 'text_overlay';
  /** Transition to next shot */
  transition?: 'cut' | 'fade' | 'dissolve' | 'wipe';
  /** Notes for production */
  productionNotes?: string;
}

/**
 * Video prompt specification
 */
export interface VideoPrompt {
  /** Overall video tone */
  tone: string;
  /** Target duration in minutes */
  targetDurationMinutes: number;
  /** Introduction hook */
  introHook: string;
  /** Key points to cover */
  keyPoints: string[];
  /** Shot list */
  shotList: VideoShot[];
  /** Call to action for ending */
  callToAction: string;
  /** Pacing guidance */
  pacingGuidance: string;
  /** Visual style notes */
  visualStyleNotes: string;
}

/**
 * Audio prompt specification
 */
export interface AudioPrompt {
  /** Overall audio tone */
  tone: string;
  /** Target duration in minutes */
  targetDurationMinutes: number;
  /** Introduction script */
  introScript: string;
  /** Key talking points */
  talkingPoints: string[];
  /** Closing script */
  closingScript: string;
  /** Pacing notes */
  pacingNotes: string;
  /** Pronunciation guide for technical terms */
  pronunciationGuide: Array<{
    term: string;
    pronunciation: string;
  }>;
  /** Background music preference */
  musicPreference: 'none' | 'subtle' | 'moderate';
}

/**
 * Infographic block specification
 */
export interface InfographicBlock {
  /** Block order */
  order: number;
  /** Block type */
  type: 'header' | 'statistic' | 'process' | 'comparison' | 'timeline' | 'checklist' | 'quote' | 'icon_list';
  /** Block title */
  title?: string;
  /** Block content */
  content: string;
  /** Icon suggestion */
  iconSuggestion?: string;
  /** Color emphasis */
  colorEmphasis?: 'primary' | 'secondary' | 'accent' | 'neutral';
  /** Layout hints */
  layoutHints?: string;
}

/**
 * Infographic specification
 */
export interface InfographicSpec {
  /** Infographic title */
  title: string;
  /** Subtitle */
  subtitle?: string;
  /** Overall layout */
  layout: 'vertical' | 'horizontal' | 'grid' | 'circular';
  /** Blocks of content */
  blocks: InfographicBlock[];
  /** Diagram requirements */
  diagramRequirements?: Array<{
    type: 'flowchart' | 'process' | 'hierarchy' | 'comparison' | 'cycle';
    description: string;
    elements: string[];
  }>;
  /** Footer content */
  footer?: string;
  /** Color scheme notes */
  colorSchemeNotes: string;
  /** Branding requirements */
  brandingRequirements?: string;
}

/**
 * Constraints for media generation
 */
export interface MediaConstraints {
  /** Maximum length for video/audio */
  maxLengthMinutes: number;
  /** Minimum length for video/audio */
  minLengthMinutes: number;
  /** Required tone */
  tone: string;
  /** Prohibited claims */
  prohibitedClaims: string[];
  /** Required disclaimers */
  requiredDisclaimers: string[];
  /** Accessibility requirements */
  accessibilityRequirements: string[];
  /** Brand voice guidelines */
  brandVoiceGuidelines?: string;
}

/**
 * Complete Media Prompt Pack
 */
export interface MediaPromptPack {
  /** Module ID */
  moduleId: ModuleId;

  /** Version */
  version: Version;

  /** Generation timestamp */
  generatedAt: Timestamp;

  /** Run ID */
  runId: string;

  /** Audio generation prompt */
  audioPrompt: AudioPrompt;

  /** Video generation prompt */
  videoPrompt: VideoPrompt;

  /** Infographic specification */
  infographicSpec: InfographicSpec;

  /** Shared constraints */
  constraints: MediaConstraints;

  /** NotebookLM-specific instructions */
  notebookLmInstructions?: string;

  /** SourcePack hash this was derived from */
  sourcePackHash: Hash;

  /** ModuleSpec hash */
  moduleSpecHash: Hash;
}

/**
 * Markdown format for NotebookLM upload
 * This is the "RUN PROMPTS" document
 */
export interface MediaPromptPackMarkdown {
  /** The complete markdown content */
  content: string;
  /** Document title */
  title: string;
  /** Metadata */
  metadata: {
    moduleId: ModuleId;
    version: Version;
    generatedAt: Timestamp;
    runId: string;
  };
}
