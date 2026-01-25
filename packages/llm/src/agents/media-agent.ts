/**
 * Media Generation Agent
 *
 * Specialized agent for generating media prompts including
 * audio, video, and infographic specifications.
 */

import type { ModuleSpec, SourcePack, MediaPromptPack, HeyGenPackage } from '@learnglobal/contracts';
import type { TokenUsage } from '../types.js';
import { BaseAgent, AgentContext, AgentConfig } from './base.js';

export interface MediaAgentInput {
  spec: ModuleSpec;
  sourcePack: SourcePack;
  customTemplate?: string;
}

export interface MediaAgentOutput {
  mediaPromptPack: MediaPromptPack;
}

export interface HeyGenAgentInput {
  spec: ModuleSpec;
  mediaPromptPack: MediaPromptPack;
  customTemplate?: string;
}

export interface HeyGenAgentOutput {
  heygenPackage: HeyGenPackage;
}

/**
 * Agent that generates media prompt packs for audio, video, and infographics
 */
export class MediaAgent extends BaseAgent<MediaAgentInput, MediaAgentOutput> {
  get name(): string {
    return 'media-agent';
  }

  get description(): string {
    return 'Generates media prompts for audio, video, and infographic content';
  }

  constructor(llmProvider: import('../types.js').LLMProvider, config?: Partial<AgentConfig>) {
    super(llmProvider, {
      temperature: 0.8,
      maxTokens: 8192,
      ...config,
    });
  }

  protected async run(
    input: MediaAgentInput,
    context: AgentContext
  ): Promise<{ data: MediaAgentOutput; usage: TokenUsage }> {
    const { spec, sourcePack, customTemplate } = input;

    this.trace('generate_media_prompts', { moduleId: spec.moduleId });

    const systemPrompt = this.buildSystemPrompt(customTemplate);
    const userPrompt = this.buildUserPrompt(spec, sourcePack);

    const { content, usage } = await this.llmProvider.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        jsonMode: true,
      }
    );

    const parsed = JSON.parse(content);

    const mediaPromptPack: MediaPromptPack = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: context.runId,
      audioPrompt: this.buildAudioPrompt(parsed.audioPrompt, spec),
      videoPrompt: this.buildVideoPrompt(parsed.videoPrompt, spec),
      infographicSpec: this.buildInfographicSpec(parsed.infographicSpec, spec),
      constraints: {
        maxLengthMinutes: spec.mediaPreferences.videoMinutesTarget + 2,
        minLengthMinutes: Math.max(1, spec.mediaPreferences.videoMinutesTarget - 2),
        tone: spec.mediaPreferences.audioTone,
        prohibitedClaims: spec.safetyBoundaries.prohibitedTopics || [],
        requiredDisclaimers: spec.safetyBoundaries.disclaimers,
        accessibilityRequirements: ['closed captions', 'clear audio', 'alt text for images'],
      },
      sourcePackHash: this.hashObject(sourcePack),
      moduleSpecHash: this.hashObject(spec),
    };

    this.trace('media_prompts_generated', {
      hasAudio: !!mediaPromptPack.audioPrompt,
      hasVideo: !!mediaPromptPack.videoPrompt,
      hasInfographic: !!mediaPromptPack.infographicSpec,
    });

    return {
      data: { mediaPromptPack },
      usage,
    };
  }

  private buildSystemPrompt(customTemplate?: string): string {
    const basePrompt = `You are an expert media producer creating content generation prompts.
Your task is to create comprehensive prompts for audio, video, and infographic generation.

CRITICAL REQUIREMENTS:
1. Audio prompts should be suitable for NotebookLM-style podcast generation
2. Video prompts should include detailed shot lists and visual guidance
3. Infographic specs should include clear block layouts and content
4. Include pronunciation guides for technical terms
5. Include all required disclaimers
6. Consider accessibility requirements
7. Output valid JSON matching the schema exactly

MEDIA GUIDELINES:
- Keep tone consistent with training context
- Focus on key learning points
- Make content engaging but professional
- Include clear calls to action
- Consider pacing and viewer/listener attention`;

    return customTemplate ? `${basePrompt}\n\nADDITIONAL GUIDANCE:\n${customTemplate}` : basePrompt;
  }

  private buildUserPrompt(spec: ModuleSpec, sourcePack: SourcePack): string {
    const keyPoints = spec.learningObjectives.slice(0, 5);
    const sectionSummaries = sourcePack.sections
      .slice(0, 5)
      .map(s => `- ${s.heading}: ${s.fullProseText.substring(0, 100)}...`);

    return `Create a media prompt pack for this training module:

MODULE: ${spec.title}
VERTICAL: ${spec.vertical}
TARGET DURATION: ${spec.mediaPreferences.videoMinutesTarget} minutes
TONE: ${spec.mediaPreferences.audioTone}
AVATAR STYLE: ${spec.mediaPreferences.avatarStyle}
INFOGRAPHIC STYLE: ${spec.mediaPreferences.infographicStyle}

LEARNING OBJECTIVES:
${keyPoints.map((o, i) => `${i + 1}. ${o}`).join('\n')}

CONTENT SUMMARY:
${sourcePack.abstract}

KEY SECTIONS:
${sectionSummaries.join('\n')}

REQUIRED DISCLAIMERS:
${spec.safetyBoundaries.disclaimers.map(d => `- ${d}`).join('\n')}

Generate a complete media prompt pack with:
1. Audio prompt for NotebookLM podcast-style discussion
2. Video prompt with detailed shot list
3. Infographic specification with block layout

Output as JSON:
{
  "audioPrompt": {
    "tone": "...",
    "targetDurationMinutes": number,
    "introScript": "...",
    "talkingPoints": [...],
    "closingScript": "...",
    "pacingNotes": "...",
    "pronunciationGuide": [...],
    "musicPreference": "..."
  },
  "videoPrompt": {
    "tone": "...",
    "targetDurationMinutes": number,
    "introHook": "...",
    "keyPoints": [...],
    "shotList": [...],
    "callToAction": "...",
    "pacingGuidance": "...",
    "visualStyleNotes": "..."
  },
  "infographicSpec": {
    "title": "...",
    "layout": "...",
    "blocks": [...],
    "colorSchemeNotes": "..."
  }
}`;
  }

  private buildAudioPrompt(
    parsed: Partial<MediaPromptPack['audioPrompt']> | undefined,
    spec: ModuleSpec
  ): MediaPromptPack['audioPrompt'] {
    return {
      tone: parsed?.tone || spec.mediaPreferences.audioTone,
      targetDurationMinutes: parsed?.targetDurationMinutes || spec.mediaPreferences.videoMinutesTarget,
      introScript: parsed?.introScript || `Welcome to this training module on ${spec.title}.`,
      talkingPoints: parsed?.talkingPoints || spec.learningObjectives,
      closingScript: parsed?.closingScript || `Thank you for completing this module on ${spec.title}.`,
      pacingNotes: parsed?.pacingNotes || 'Maintain a steady, educational pace. Allow brief pauses between topics.',
      pronunciationGuide: parsed?.pronunciationGuide || [],
      musicPreference: parsed?.musicPreference || 'subtle',
    };
  }

  private buildVideoPrompt(
    parsed: Partial<MediaPromptPack['videoPrompt']> | undefined,
    spec: ModuleSpec
  ): MediaPromptPack['videoPrompt'] {
    return {
      tone: parsed?.tone || spec.mediaPreferences.audioTone,
      targetDurationMinutes: parsed?.targetDurationMinutes || spec.mediaPreferences.videoMinutesTarget,
      introHook: parsed?.introHook || `In this video, you'll learn about ${spec.title}.`,
      keyPoints: parsed?.keyPoints || spec.learningObjectives,
      shotList: parsed?.shotList || this.generateDefaultShotList(spec),
      callToAction: parsed?.callToAction || 'Complete the assessment to test your knowledge.',
      pacingGuidance: parsed?.pacingGuidance || 'Keep a conversational pace. Use visual transitions between topics.',
      visualStyleNotes: parsed?.visualStyleNotes || spec.mediaPreferences.infographicStyle,
    };
  }

  private generateDefaultShotList(spec: ModuleSpec): MediaPromptPack['videoPrompt']['shotList'] {
    const shots: MediaPromptPack['videoPrompt']['shotList'] = [
      {
        shotNumber: 1,
        description: 'Introduction - presenter welcomes viewers',
        durationSeconds: 30,
        visualNotes: 'Clean background, presenter centered',
        narrationCue: 'Introduction script',
      },
    ];

    spec.learningObjectives.forEach((obj, index) => {
      shots.push({
        shotNumber: index + 2,
        description: `Cover learning objective: ${obj.substring(0, 50)}...`,
        durationSeconds: Math.floor((spec.mediaPreferences.videoMinutesTarget * 60) / spec.learningObjectives.length),
        visualNotes: 'Supporting graphics or slides',
        narrationCue: `Explain: ${obj}`,
      });
    });

    shots.push({
      shotNumber: shots.length + 1,
      description: 'Conclusion - summary and call to action',
      durationSeconds: 30,
      visualNotes: 'Presenter with summary points on screen',
      narrationCue: 'Closing script with call to action',
    });

    return shots;
  }

  private buildInfographicSpec(
    parsed: Partial<MediaPromptPack['infographicSpec']> | undefined,
    spec: ModuleSpec
  ): MediaPromptPack['infographicSpec'] {
    return {
      title: parsed?.title || spec.title,
      layout: parsed?.layout || 'vertical',
      blocks: parsed?.blocks || this.generateDefaultBlocks(spec),
      colorSchemeNotes: parsed?.colorSchemeNotes || `Use professional colors appropriate for ${spec.vertical} industry.`,
    };
  }

  private generateDefaultBlocks(spec: ModuleSpec): MediaPromptPack['infographicSpec']['blocks'] {
    const blocks: MediaPromptPack['infographicSpec']['blocks'] = [
      {
        id: 'header',
        type: 'header' as const,
        title: spec.title,
        order: 0,
      },
    ];

    spec.learningObjectives.forEach((obj, index) => {
      blocks.push({
        id: `objective-${index + 1}`,
        type: 'text' as const,
        title: `Key Point ${index + 1}`,
        content: obj,
        order: index + 1,
      });
    });

    blocks.push({
      id: 'footer',
      type: 'footer' as const,
      title: 'Resources',
      order: blocks.length,
    });

    return blocks;
  }

  private hashObject(obj: unknown): string {
    const { createHash } = require('crypto');
    const json = JSON.stringify(obj, Object.keys(obj as object).sort());
    return createHash('sha256').update(json).digest('hex');
  }
}

/**
 * Agent that generates HeyGen video packages from media prompts
 */
export class HeyGenAgent extends BaseAgent<HeyGenAgentInput, HeyGenAgentOutput> {
  get name(): string {
    return 'heygen-agent';
  }

  get description(): string {
    return 'Generates HeyGen avatar video packages from media prompts';
  }

  constructor(llmProvider: import('../types.js').LLMProvider, config?: Partial<AgentConfig>) {
    super(llmProvider, {
      temperature: 0.7,
      maxTokens: 8192,
      ...config,
    });
  }

  protected async run(
    input: HeyGenAgentInput,
    context: AgentContext
  ): Promise<{ data: HeyGenAgentOutput; usage: TokenUsage }> {
    const { spec, mediaPromptPack, customTemplate } = input;

    this.trace('generate_heygen_package', { moduleId: spec.moduleId });

    const systemPrompt = this.buildSystemPrompt(customTemplate);
    const userPrompt = this.buildUserPrompt(spec, mediaPromptPack);

    const { content, usage } = await this.llmProvider.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        jsonMode: true,
      }
    );

    const parsed = JSON.parse(content);

    const heygenPackage: HeyGenPackage = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: context.runId,
      title: spec.title,
      description: spec.description,
      narrationScript: parsed.narrationScript || '',
      sceneBreakdown: parsed.sceneBreakdown || this.generateDefaultScenes(mediaPromptPack),
      pronunciationGuide: parsed.pronunciationGuide || mediaPromptPack.audioPrompt.pronunciationGuide,
      onScreenTextCues: parsed.onScreenTextCues || [],
      avatarConfig: {
        style: spec.mediaPreferences.avatarStyle,
        voiceSpeed: parsed.avatarConfig?.voiceSpeed || 1.0,
        emotion: parsed.avatarConfig?.emotion,
        gesture: parsed.avatarConfig?.gesture,
      },
      videoSettings: {
        resolution: '1080p',
        aspectRatio: '16:9',
        frameRate: 30,
        format: 'mp4',
        quality: 'high',
        includeCaptions: true,
        captionStyle: 'bottom',
      },
      estimatedDurationSeconds: mediaPromptPack.videoPrompt.targetDurationMinutes * 60,
      narrationWordCount: this.countWords(parsed.narrationScript || ''),
      mediaPromptPackHash: this.hashObject(mediaPromptPack),
      sourcePackHash: mediaPromptPack.sourcePackHash,
      moduleSpecHash: this.hashObject(spec),
    };

    this.trace('heygen_package_generated', {
      scenes: heygenPackage.sceneBreakdown.length,
      narrationWords: heygenPackage.narrationWordCount,
      estimatedDuration: heygenPackage.estimatedDurationSeconds,
    });

    return {
      data: { heygenPackage },
      usage,
    };
  }

  private buildSystemPrompt(customTemplate?: string): string {
    const basePrompt = `You are an expert video scriptwriter creating HeyGen avatar video scripts.
Your task is to create a complete video package with narration script, scene breakdown, and cues.

CRITICAL REQUIREMENTS:
1. Write conversational, presenter-style narration
2. Include scene-by-scene breakdown with timing
3. Provide pronunciation guide for technical terms
4. Include on-screen text cues with timing
5. Keep total duration within target
6. Make content engaging and educational
7. Output valid JSON matching the schema exactly

NARRATION STYLE:
- Conversational but professional
- Direct address to viewer ("you will learn...")
- Clear transitions between topics
- Natural pauses for emphasis
- Avoid jargon without explanation`;

    return customTemplate ? `${basePrompt}\n\nADDITIONAL GUIDANCE:\n${customTemplate}` : basePrompt;
  }

  private buildUserPrompt(spec: ModuleSpec, mediaPromptPack: MediaPromptPack): string {
    return `Create a HeyGen video package based on this media prompt pack:

MODULE: ${spec.title}
TARGET DURATION: ${mediaPromptPack.videoPrompt.targetDurationMinutes} minutes
AVATAR STYLE: ${spec.mediaPreferences.avatarStyle}

VIDEO PROMPT:
${JSON.stringify(mediaPromptPack.videoPrompt, null, 2)}

CONSTRAINTS:
${JSON.stringify(mediaPromptPack.constraints, null, 2)}

Generate:
1. Complete narration script (conversational, presenter-style, ~150 words per minute)
2. Scene-by-scene breakdown with timing
3. Pronunciation guide for technical terms
4. On-screen text cues with timing

Output as JSON:
{
  "narrationScript": "...(full script)...",
  "sceneBreakdown": [
    {
      "sceneNumber": 1,
      "title": "...",
      "narrationText": "...",
      "durationSeconds": number,
      "avatarAction": "...",
      "backgroundDescription": "..."
    }
  ],
  "pronunciationGuide": [
    {"term": "...", "pronunciation": "...", "phonetic": "..."}
  ],
  "onScreenTextCues": [
    {"text": "...", "startTime": number, "duration": number, "position": "..."}
  ],
  "avatarConfig": {
    "voiceSpeed": 1.0,
    "emotion": "friendly",
    "gesture": "natural"
  }
}`;
  }

  private generateDefaultScenes(mediaPromptPack: MediaPromptPack): HeyGenPackage['sceneBreakdown'] {
    return mediaPromptPack.videoPrompt.shotList.map(shot => ({
      sceneNumber: shot.shotNumber,
      title: shot.description,
      narrationText: shot.narrationCue,
      durationSeconds: shot.durationSeconds,
      avatarAction: 'speaking naturally',
      backgroundDescription: shot.visualNotes,
    }));
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  private hashObject(obj: unknown): string {
    const { createHash } = require('crypto');
    const json = JSON.stringify(obj, Object.keys(obj as object).sort());
    return createHash('sha256').update(json).digest('hex');
  }
}
