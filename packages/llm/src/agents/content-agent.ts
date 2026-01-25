/**
 * Content Generation Agent
 *
 * Specialized agent for generating full prose training content
 * from outlines and specifications.
 */

import type { ModuleSpec, Outline, SourcePack } from '@learnglobal/contracts';
import type { TokenUsage } from '../types.js';
import { BaseAgent, AgentContext, AgentConfig } from './base.js';

export interface ContentAgentInput {
  spec: ModuleSpec;
  outline: Outline;
  customTemplate?: string;
}

export interface ContentAgentOutput {
  sourcePack: SourcePack;
}

/**
 * Agent that generates full prose content from outlines
 */
export class ContentAgent extends BaseAgent<ContentAgentInput, ContentAgentOutput> {
  get name(): string {
    return 'content-agent';
  }

  get description(): string {
    return 'Generates full prose training content from outlines and specifications';
  }

  constructor(llmProvider: import('../types.js').LLMProvider, config?: Partial<AgentConfig>) {
    super(llmProvider, {
      temperature: 0.8,
      maxTokens: 8192,
      timeoutMs: 300000, // 5 minutes for large content
      ...config,
    });
  }

  protected async run(
    input: ContentAgentInput,
    context: AgentContext
  ): Promise<{ data: ContentAgentOutput; usage: TokenUsage }> {
    const { spec, outline, customTemplate } = input;

    this.trace('generate_content', { moduleId: spec.moduleId, sections: outline.headings.length });

    const systemPrompt = this.buildSystemPrompt(customTemplate);
    let totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    // Generate content section by section
    const sections: SourcePack['sections'] = [];

    for (const heading of outline.headings) {
      const sectionResult = await this.generateSection(spec, heading, systemPrompt, context);
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
      runId: context.runId,
      title: spec.title,
      abstract: spec.description,
      sections,
      disclaimers: spec.safetyBoundaries.disclaimers,
      totalWordCount: totalWords,
      outlineHash: this.hashObject(outline),
      moduleSpecHash: this.hashObject(spec),
    };

    this.trace('content_generated', {
      sectionCount: sections.length,
      totalWords,
    });

    return {
      data: { sourcePack },
      usage: totalUsage,
    };
  }

  private async generateSection(
    spec: ModuleSpec,
    heading: Outline['headings'][0],
    systemPrompt: string,
    context: AgentContext
  ): Promise<{ section: SourcePack['sections'][0]; usage: TokenUsage }> {
    const userPrompt = this.buildSectionPrompt(spec, heading);

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

    // Generate children recursively
    let children: SourcePack['sections'] | undefined;
    let childUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    if (heading.children && heading.children.length > 0) {
      children = [];
      for (const child of heading.children) {
        const childResult = await this.generateSection(spec, child, systemPrompt, context);
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

    return {
      section,
      usage: {
        prompt: usage.prompt + childUsage.prompt,
        completion: usage.completion + childUsage.completion,
        total: usage.total + childUsage.total,
      },
    };
  }

  private buildSystemPrompt(customTemplate?: string): string {
    const basePrompt = `You are an expert technical writer creating comprehensive training content.
Your task is to generate FULL PROSE content for training modules.

CRITICAL REQUIREMENTS:
1. NO BULLET POINTS OR OUTLINES - Write in flowing prose paragraphs
2. Each section must have substantial, professional prose (minimum 500 words)
3. Use clear, educational language appropriate for adult learners
4. Include embedded scenarios as dialogue scripts where specified
5. Include checklists and forms where specified (these can use bullet format)
6. Reference standards explicitly with traceability markers
7. Include all required disclaimers naturally in the content
8. Maintain consistent tone and voice throughout
9. Output valid JSON with complete prose content

WRITING STYLE:
- Professional but accessible
- Use active voice
- Include practical examples
- Connect theory to real-world application
- Use transitions between paragraphs
- Avoid jargon unless explained`;

    return customTemplate ? `${basePrompt}\n\nADDITIONAL GUIDANCE:\n${customTemplate}` : basePrompt;
  }

  private buildSectionPrompt(spec: ModuleSpec, heading: Outline['headings'][0]): string {
    const objectives = heading.mapping.learningObjectiveIndices
      .map(i => spec.learningObjectives[i])
      .filter(Boolean);

    const standards = heading.mapping.standardRefs
      .map(ref => spec.standardsMap.find(s => s.standardId === ref))
      .filter(Boolean);

    const artifacts = heading.mapping.artifactIds
      ? heading.mapping.artifactIds
          .map(id => spec.requiredArtifacts.find(a => a.id === id))
          .filter(Boolean)
      : [];

    const scenarios = heading.mapping.scenarioIds
      ? heading.mapping.scenarioIds
          .map(id => spec.scenarios.find(s => s.id === id))
          .filter(Boolean)
      : [];

    return `Generate full prose content for this section:

SECTION: ${heading.title}
DESCRIPTION: ${heading.description}
MINIMUM WORDS: ${Math.max(500, heading.estimatedWordCount || 500)}

${objectives.length > 0 ? `LEARNING OBJECTIVES TO ADDRESS:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}` : ''}

${standards.length > 0 ? `STANDARDS TO REFERENCE:\n${standards.map(s => `- ${s!.standardId}: ${s!.title}`).join('\n')}` : ''}

${artifacts.length > 0 ? `ARTIFACTS TO INCLUDE:\n${artifacts.map(a => `- ${a!.type}: ${a!.title}`).join('\n')}` : ''}

${scenarios.length > 0 ? `SCENARIOS TO EMBED:\n${scenarios.map(s => `- ${s!.id}: ${s!.title} (${s!.type})`).join('\n')}` : ''}

Write comprehensive, professional prose. NO BULLET POINTS except inside clearly marked checklists.

Output as JSON:
{
  "id": "${heading.id}",
  "level": ${heading.level},
  "heading": "${heading.title}",
  "fullProseText": "...(full prose content, multiple paragraphs, minimum ${Math.max(500, heading.estimatedWordCount || 500)} words)...",
  "embeddedScenarios": [...],
  "embeddedChecklists": [...],
  "traceability": [{"type": "standard", "ref": "...", "text": "..."}],
  "wordCount": number
}`;
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
