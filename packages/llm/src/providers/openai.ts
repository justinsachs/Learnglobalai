/**
 * OpenAI LLM Provider Implementation
 */

import OpenAI from 'openai';
import type {
  ModuleSpec,
  Outline,
  SourcePack,
  QAReport,
  MediaPromptPack,
  HeyGenPackage,
} from '@learnglobal/contracts';
import type { LLMProvider, LLMConfig, TokenUsage } from '../types.js';
import { createHash } from 'crypto';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organizationId,
    });
  }

  async generateOutline(
    spec: ModuleSpec,
    template: string
  ): Promise<{ outline: Outline; usage: TokenUsage }> {
    const systemPrompt = `You are an expert instructional designer creating training module outlines.
Your task is to create a detailed, hierarchical outline for a training module.

CRITICAL REQUIREMENTS:
1. Every learning objective must be mapped to at least one section
2. Every standard/regulation must be addressed in at least one section
3. Include sections for all required artifacts (checklists, forms, scenarios)
4. Estimate realistic word counts for each section
5. Output valid JSON matching the schema exactly

${template}`;

    const userPrompt = `Create a comprehensive outline for this training module:

MODULE SPECIFICATION:
${JSON.stringify(spec, null, 2)}

Generate a detailed outline that:
- Addresses all ${spec.learningObjectives.length} learning objectives
- Covers all ${spec.standardsMap.length} standards/regulations
- Includes all ${spec.requiredArtifacts.length} required artifacts
- Has a minimum of ${spec.constraints.minTotalWords} total estimated words
- Each major section has at least ${spec.constraints.minWordsPerMajorHeading} words

Output the outline as valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const outline: Outline = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: '', // Will be set by caller
      headings: parsed.headings || [],
      summary: parsed.summary || '',
      totalEstimatedWordCount: parsed.totalEstimatedWordCount || 0,
      validationNotes: parsed.validationNotes,
      moduleSpecHash: this.hashObject(spec),
    };

    const usage: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    };

    return { outline, usage };
  }

  async generateSourcePack(
    spec: ModuleSpec,
    outline: Outline,
    template: string
  ): Promise<{ sourcePack: SourcePack; usage: TokenUsage }> {
    const systemPrompt = `You are an expert technical writer creating comprehensive training content.
Your task is to generate FULL PROSE content for a training module.

CRITICAL REQUIREMENTS:
1. NO BULLET POINTS OR OUTLINES - Write in flowing prose paragraphs
2. Each section must have substantial, professional prose (minimum words per section)
3. Include embedded scenarios as dialogue scripts
4. Include checklists and forms where specified
5. Reference standards explicitly with traceability
6. Include all required disclaimers
7. Output valid JSON with full prose content

${template}`;

    // Generate content section by section to handle token limits
    const sections: SourcePack['sections'] = [];
    let totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    for (const heading of outline.headings) {
      const sectionResult = await this.generateSection(
        spec,
        heading,
        systemPrompt
      );
      sections.push(sectionResult.section);
      totalUsage.prompt += sectionResult.usage.prompt;
      totalUsage.completion += sectionResult.usage.completion;
      totalUsage.total += sectionResult.usage.total;
    }

    // Calculate total word count
    let totalWords = 0;
    const countWords = (secs: SourcePack['sections']): void => {
      for (const s of secs) {
        totalWords += s.wordCount;
        if (s.children) countWords(s.children);
      }
    };
    countWords(sections);

    const sourcePack: SourcePack = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: '', // Will be set by caller
      title: spec.title,
      abstract: spec.description,
      sections,
      disclaimers: spec.safetyBoundaries.disclaimers,
      totalWordCount: totalWords,
      outlineHash: this.hashObject(outline),
      moduleSpecHash: this.hashObject(spec),
    };

    return { sourcePack, usage: totalUsage };
  }

  private async generateSection(
    spec: ModuleSpec,
    heading: Outline['headings'][0],
    systemPrompt: string
  ): Promise<{ section: SourcePack['sections'][0]; usage: TokenUsage }> {
    const userPrompt = `Generate full prose content for this section:

SECTION: ${heading.title}
DESCRIPTION: ${heading.description}
MINIMUM WORDS: ${Math.max(500, heading.estimatedWordCount || 500)}

Learning objectives to address: ${heading.mapping.learningObjectiveIndices.map(i => spec.learningObjectives[i]).join(', ')}
Standards to reference: ${heading.mapping.standardRefs.join(', ')}
${heading.mapping.artifactIds ? `Artifacts to include: ${heading.mapping.artifactIds.join(', ')}` : ''}
${heading.mapping.scenarioIds ? `Scenarios to include: ${heading.mapping.scenarioIds.join(', ')}` : ''}

Write comprehensive, professional prose. NO BULLET POINTS except inside clearly marked checklists.
Output as JSON with this structure:
{
  "id": "${heading.id}",
  "level": ${heading.level},
  "heading": "${heading.title}",
  "fullProseText": "...(full prose content, multiple paragraphs)...",
  "embeddedScenarios": [...],
  "embeddedChecklists": [...],
  "traceability": [...],
  "wordCount": number
}`;

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Generate children recursively
    let children: SourcePack['sections'] | undefined;
    let childUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    if (heading.children && heading.children.length > 0) {
      children = [];
      for (const child of heading.children) {
        const childResult = await this.generateSection(spec, child, systemPrompt);
        children.push(childResult.section);
        childUsage.prompt += childResult.usage.prompt;
        childUsage.completion += childResult.usage.completion;
        childUsage.total += childResult.usage.total;
      }
    }

    const section: SourcePack['sections'][0] = {
      id: parsed.id || heading.id,
      level: parsed.level || heading.level,
      heading: parsed.heading || heading.title,
      fullProseText: parsed.fullProseText || '',
      embeddedScenarios: parsed.embeddedScenarios,
      embeddedChecklists: parsed.embeddedChecklists,
      embeddedForms: parsed.embeddedForms,
      embeddedArtifacts: parsed.embeddedArtifacts,
      traceability: parsed.traceability || [],
      children,
      wordCount: parsed.wordCount || this.countWords(parsed.fullProseText || ''),
    };

    const usage: TokenUsage = {
      prompt: (response.usage?.prompt_tokens || 0) + childUsage.prompt,
      completion: (response.usage?.completion_tokens || 0) + childUsage.completion,
      total: (response.usage?.total_tokens || 0) + childUsage.total,
    };

    return { section, usage };
  }

  async generateQAReport(
    spec: ModuleSpec,
    sourcePack: SourcePack
  ): Promise<{ qaReport: QAReport; usage: TokenUsage }> {
    // QA validation is primarily rule-based, not LLM-based
    // This is a placeholder that returns empty usage
    // Actual QA logic is in the orchestrator's qa-passed state handler

    const qaReport: QAReport = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: sourcePack.runId,
      sourcePackHash: this.hashObject(sourcePack),
      moduleSpecHash: this.hashObject(spec),
      wordCounts: {
        perSection: [],
        total: sourcePack.totalWordCount,
        requiredMinimum: spec.constraints.minTotalWords,
        totalMeetsMinimum: sourcePack.totalWordCount >= spec.constraints.minTotalWords,
      },
      formatting: {
        totalLines: 0,
        bulletLines: 0,
        numberedLines: 0,
        bulletRatio: 0,
        bulletRatioAcceptable: true,
        bulletRatioThreshold: spec.constraints.maxBulletRatio,
        forbiddenFormattingViolations: [],
      },
      artifactValidation: [],
      standardsCoverage: [],
      disclaimerValidation: [],
      scopeBoundaryValidation: {
        scopeStatementFound: true,
        escalationTriggersMentioned: true,
        prohibitedTopicViolations: [],
        sensitiveTopicsHandled: true,
      },
      failures: [],
      warnings: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warningCount: 0,
      },
      passed: true,
      failureReasons: [],
    };

    return { qaReport, usage: { prompt: 0, completion: 0, total: 0 } };
  }

  async generateMediaPromptPack(
    spec: ModuleSpec,
    sourcePack: SourcePack,
    template: string
  ): Promise<{ mediaPromptPack: MediaPromptPack; usage: TokenUsage }> {
    const systemPrompt = `You are an expert media producer creating content generation prompts.
Your task is to create comprehensive prompts for audio, video, and infographic generation.

${template}`;

    const userPrompt = `Create a media prompt pack for this training module:

MODULE: ${spec.title}
VERTICAL: ${spec.vertical}
TARGET DURATION: ${spec.mediaPreferences.videoMinutesTarget} minutes
TONE: ${spec.mediaPreferences.audioTone}
STYLE: ${spec.mediaPreferences.avatarStyle}

SOURCE CONTENT SUMMARY:
${sourcePack.abstract}

LEARNING OBJECTIVES:
${spec.learningObjectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Generate a complete media prompt pack with:
1. Audio prompt (for NotebookLM podcast-style generation)
2. Video prompt with shot list
3. Infographic specification with blocks

Output as valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const mediaPromptPack: MediaPromptPack = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: sourcePack.runId,
      audioPrompt: parsed.audioPrompt || {
        tone: spec.mediaPreferences.audioTone,
        targetDurationMinutes: spec.mediaPreferences.videoMinutesTarget,
        introScript: '',
        talkingPoints: spec.learningObjectives,
        closingScript: '',
        pacingNotes: '',
        pronunciationGuide: [],
        musicPreference: 'subtle',
      },
      videoPrompt: parsed.videoPrompt || {
        tone: spec.mediaPreferences.audioTone,
        targetDurationMinutes: spec.mediaPreferences.videoMinutesTarget,
        introHook: '',
        keyPoints: spec.learningObjectives,
        shotList: [],
        callToAction: '',
        pacingGuidance: '',
        visualStyleNotes: spec.mediaPreferences.infographicStyle,
      },
      infographicSpec: parsed.infographicSpec || {
        title: spec.title,
        layout: 'vertical',
        blocks: [],
        colorSchemeNotes: '',
      },
      constraints: {
        maxLengthMinutes: spec.mediaPreferences.videoMinutesTarget + 2,
        minLengthMinutes: Math.max(1, spec.mediaPreferences.videoMinutesTarget - 2),
        tone: spec.mediaPreferences.audioTone,
        prohibitedClaims: spec.safetyBoundaries.prohibitedTopics || [],
        requiredDisclaimers: spec.safetyBoundaries.disclaimers,
        accessibilityRequirements: ['closed captions', 'clear audio'],
      },
      sourcePackHash: this.hashObject(sourcePack),
      moduleSpecHash: this.hashObject(spec),
    };

    const usage: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    };

    return { mediaPromptPack, usage };
  }

  async generateHeyGenPackage(
    spec: ModuleSpec,
    mediaPromptPack: MediaPromptPack,
    template: string
  ): Promise<{ heygenPackage: HeyGenPackage; usage: TokenUsage }> {
    const systemPrompt = `You are an expert video scriptwriter creating HeyGen avatar video scripts.
Your task is to create a complete video package with narration script, scene breakdown, and cues.

${template}`;

    const userPrompt = `Create a HeyGen video package based on this media prompt pack:

VIDEO PROMPT:
${JSON.stringify(mediaPromptPack.videoPrompt, null, 2)}

CONSTRAINTS:
${JSON.stringify(mediaPromptPack.constraints, null, 2)}

Generate:
1. Complete narration script (conversational, presenter-style)
2. Scene-by-scene breakdown with timing
3. Pronunciation guide for technical terms
4. On-screen text cues

Output as valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const heygenPackage: HeyGenPackage = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: mediaPromptPack.runId,
      title: spec.title,
      description: spec.description,
      narrationScript: parsed.narrationScript || '',
      sceneBreakdown: parsed.sceneBreakdown || [],
      pronunciationGuide: parsed.pronunciationGuide || [],
      onScreenTextCues: parsed.onScreenTextCues || [],
      avatarConfig: {
        style: spec.mediaPreferences.avatarStyle,
        voiceSpeed: 1.0,
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

    const usage: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    };

    return { heygenPackage, usage };
  }

  async complete(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    }
  ): Promise<{ content: string; usage: TokenUsage }> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: options?.temperature ?? this.config.temperature,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      ...(options?.jsonMode && { response_format: { type: 'json_object' } }),
    });

    const content = response.choices[0]?.message?.content || '';
    const usage: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    };

    return { content, usage };
  }

  private hashObject(obj: unknown): string {
    const json = JSON.stringify(obj, Object.keys(obj as object).sort());
    return createHash('sha256').update(json).digest('hex');
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}
