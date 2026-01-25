/**
 * LLM Agent Framework Exports
 *
 * Provides specialized agents for different parts of the content generation pipeline.
 */

export {
  BaseAgent,
  AgentRegistry,
  agentRegistry,
  type AgentContext,
  type AgentResult,
  type AgentTrace,
  type AgentConfig,
  DEFAULT_AGENT_CONFIG,
} from './base.js';

export {
  OutlineAgent,
  type OutlineAgentInput,
  type OutlineAgentOutput,
} from './outline-agent.js';

export {
  ContentAgent,
  type ContentAgentInput,
  type ContentAgentOutput,
} from './content-agent.js';

export {
  QAAgent,
  type QAAgentInput,
  type QAAgentOutput,
} from './qa-agent.js';

export {
  MediaAgent,
  HeyGenAgent,
  type MediaAgentInput,
  type MediaAgentOutput,
  type HeyGenAgentInput,
  type HeyGenAgentOutput,
} from './media-agent.js';

import type { LLMProvider } from '../types.js';
import { agentRegistry } from './base.js';
import { OutlineAgent } from './outline-agent.js';
import { ContentAgent } from './content-agent.js';
import { QAAgent } from './qa-agent.js';
import { MediaAgent, HeyGenAgent } from './media-agent.js';

/**
 * Initialize and register all agents with a provider
 */
export function initializeAgents(llmProvider: LLMProvider): void {
  agentRegistry.register(new OutlineAgent(llmProvider));
  agentRegistry.register(new ContentAgent(llmProvider));
  agentRegistry.register(new QAAgent(llmProvider));
  agentRegistry.register(new MediaAgent(llmProvider));
  agentRegistry.register(new HeyGenAgent(llmProvider));
}

/**
 * Create a complete agent toolkit for the pipeline
 */
export function createAgentToolkit(llmProvider: LLMProvider) {
  return {
    outline: new OutlineAgent(llmProvider),
    content: new ContentAgent(llmProvider),
    qa: new QAAgent(llmProvider),
    media: new MediaAgent(llmProvider),
    heygen: new HeyGenAgent(llmProvider),
  };
}
