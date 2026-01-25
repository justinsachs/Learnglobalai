/**
 * Outline Generation Agent
 *
 * Specialized agent for generating comprehensive training module outlines
 * from module specifications.
 */

import type { ModuleSpec, Outline } from '@learnglobal/contracts';
import type { TokenUsage } from '../types.js';
import { BaseAgent, AgentContext, AgentConfig } from './base.js';

export interface OutlineAgentInput {
  spec: ModuleSpec;
  customTemplate?: string;
}

export interface OutlineAgentOutput {
  outline: Outline;
}

/**
 * Agent that generates structured outlines from module specifications
 */
export class OutlineAgent extends BaseAgent<OutlineAgentInput, OutlineAgentOutput> {
  get name(): string {
    return 'outline-agent';
  }

  get description(): string {
    return 'Generates comprehensive training module outlines from specifications';
  }

  constructor(llmProvider: import('../types.js').LLMProvider, config?: Partial<AgentConfig>) {
    super(llmProvider, {
      temperature: 0.7,
      maxTokens: 8192,
      ...config,
    });
  }

  protected async run(
    input: OutlineAgentInput,
    context: AgentContext
  ): Promise<{ data: OutlineAgentOutput; usage: TokenUsage }> {
    const { spec, customTemplate } = input;

    this.trace('generate_outline', { moduleId: spec.moduleId });

    const systemPrompt = this.buildSystemPrompt(customTemplate);
    const userPrompt = this.buildUserPrompt(spec);

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

    const outline: Outline = {
      moduleId: spec.moduleId,
      version: spec.version,
      generatedAt: new Date().toISOString(),
      runId: context.runId,
      headings: this.buildHeadings(parsed.headings || [], spec),
      summary: parsed.summary || `Outline for ${spec.title}`,
      totalEstimatedWordCount: parsed.totalEstimatedWordCount || spec.constraints.minTotalWords,
      validationNotes: parsed.validationNotes,
      moduleSpecHash: this.hashObject(spec),
    };

    this.trace('outline_generated', {
      headingCount: outline.headings.length,
      estimatedWords: outline.totalEstimatedWordCount,
    });

    return {
      data: { outline },
      usage,
    };
  }

  private buildSystemPrompt(customTemplate?: string): string {
    const basePrompt = `You are an expert instructional designer creating training module outlines.
Your task is to create a detailed, hierarchical outline for a training module.

CRITICAL REQUIREMENTS:
1. Every learning objective must be mapped to at least one section
2. Every standard/regulation must be addressed in at least one section
3. Include sections for all required artifacts (checklists, forms, scenarios)
4. Estimate realistic word counts for each section
5. Create a logical learning progression (introduction → core concepts → application → assessment)
6. Each major section should have 2-4 subsections
7. Output valid JSON matching the schema exactly

OUTLINE STRUCTURE:
- Introduction section with overview and objectives
- Core content sections covering each learning objective
- Practical application sections with scenarios
- Assessment/summary section
- Each section needs: id, level, title, description, estimatedWordCount, mapping`;

    return customTemplate ? `${basePrompt}\n\nADDITIONAL GUIDANCE:\n${customTemplate}` : basePrompt;
  }

  private buildUserPrompt(spec: ModuleSpec): string {
    return `Create a comprehensive outline for this training module:

MODULE SPECIFICATION:
Title: ${spec.title}
Vertical: ${spec.vertical}
Description: ${spec.description}

LEARNING OBJECTIVES (${spec.learningObjectives.length}):
${spec.learningObjectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

STANDARDS/REGULATIONS (${spec.standardsMap.length}):
${spec.standardsMap.map(s => `- ${s.standardId}: ${s.title} (${s.applicableSections.join(', ')})`).join('\n')}

REQUIRED ARTIFACTS (${spec.requiredArtifacts.length}):
${spec.requiredArtifacts.map(a => `- ${a.type}: ${a.title} (${a.id})`).join('\n')}

SCENARIOS:
${spec.scenarios.map(s => `- ${s.id}: ${s.title} (${s.type})`).join('\n')}

CONSTRAINTS:
- Minimum total words: ${spec.constraints.minTotalWords}
- Minimum words per major heading: ${spec.constraints.minWordsPerMajorHeading}
- Maximum bullet ratio: ${spec.constraints.maxBulletRatio}
- Maximum heading level: ${spec.constraints.maxHeadingLevel}

Generate a detailed outline with at least 6-8 major sections that:
- Addresses all ${spec.learningObjectives.length} learning objectives
- Covers all ${spec.standardsMap.length} standards/regulations
- Includes all ${spec.requiredArtifacts.length} required artifacts
- Has a minimum of ${spec.constraints.minTotalWords} total estimated words

Output as JSON with structure:
{
  "headings": [...],
  "summary": "...",
  "totalEstimatedWordCount": number,
  "validationNotes": "..."
}`;
  }

  private buildHeadings(
    parsed: Array<{
      id?: string;
      level?: number;
      title?: string;
      description?: string;
      estimatedWordCount?: number;
      mapping?: {
        learningObjectiveIndices?: number[];
        standardRefs?: string[];
        artifactIds?: string[];
        scenarioIds?: string[];
      };
      children?: unknown[];
    }>,
    spec: ModuleSpec
  ): Outline['headings'] {
    return parsed.map((h, index) => ({
      id: h.id || `section-${index + 1}`,
      level: h.level || 1,
      title: h.title || `Section ${index + 1}`,
      description: h.description || '',
      estimatedWordCount: h.estimatedWordCount || Math.floor(spec.constraints.minTotalWords / parsed.length),
      mapping: {
        learningObjectiveIndices: h.mapping?.learningObjectiveIndices || [],
        standardRefs: h.mapping?.standardRefs || [],
        artifactIds: h.mapping?.artifactIds,
        scenarioIds: h.mapping?.scenarioIds,
      },
      children: h.children ? this.buildHeadings(h.children as typeof parsed, spec) : undefined,
    }));
  }

  private hashObject(obj: unknown): string {
    const { createHash } = require('crypto');
    const json = JSON.stringify(obj, Object.keys(obj as object).sort());
    return createHash('sha256').update(json).digest('hex');
  }
}
