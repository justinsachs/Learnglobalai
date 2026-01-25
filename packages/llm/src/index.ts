/**
 * @learnglobal/llm
 *
 * LLM provider abstraction for LearnGlobal.ai content generation
 */

export * from './types.js';
export { OpenAIProvider } from './providers/openai.js';

import { OpenAIProvider } from './providers/openai.js';
import type { LLMProvider, LLMConfig } from './types.js';

/**
 * Create an LLM provider based on configuration
 */
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Default prompt templates
 */
export const DEFAULT_TEMPLATES = {
  outline: `Generate a comprehensive training module outline that:
- Maps all learning objectives to sections
- References all applicable standards
- Includes placeholders for required artifacts
- Estimates realistic word counts
- Follows a logical learning progression`,

  sourcepack: `Generate full prose training content that:
- Uses flowing paragraphs, NOT bullet points
- Includes detailed explanations and examples
- Embeds scenarios as dialogue scripts
- Includes properly formatted checklists/forms
- References standards with traceability
- Meets minimum word count requirements`,

  qa: `Validate the generated content for:
- Word count requirements (total and per section)
- Bullet ratio limits (prose-heavy content)
- Required artifact presence
- Standards coverage
- Disclaimer inclusion
- Scope boundary compliance`,

  mediaPromptPack: `Create media generation prompts for:
- Audio: Podcast-style discussion prompts
- Video: Shot list and visual guidance
- Infographic: Block layout and content
Include constraints, disclaimers, and accessibility requirements`,

  heygenScript: `Create a HeyGen video script with:
- Conversational narration script
- Scene-by-scene breakdown
- Pronunciation guide for technical terms
- On-screen text cues with timing
- Avatar action and background guidance`,
};

/**
 * Load template from file or use default
 */
export function getTemplate(type: keyof typeof DEFAULT_TEMPLATES, customTemplate?: string): string {
  return customTemplate || DEFAULT_TEMPLATES[type];
}
