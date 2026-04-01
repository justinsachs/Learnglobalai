/**
 * @learnglobal/contracts
 *
 * Central package for all LearnGlobal.ai data contracts, types, and validation schemas.
 * This package defines the API contracts between all system components.
 */

// Export all types
export * from './types/index.js';

// Export all schemas
export * from './schemas/index.js';

// Export version for contract versioning
export const CONTRACT_VERSION = '1.0.0';

// Pipeline state utilities
import { PipelineState } from './types/base.js';

/**
 * Valid state transitions for the pipeline
 */
export const VALID_STATE_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  [PipelineState.DRAFT_MODULE_SPEC]: [PipelineState.OUTLINE_GENERATED, PipelineState.FAILED],
  [PipelineState.OUTLINE_GENERATED]: [PipelineState.SOURCEPACK_GENERATED, PipelineState.FAILED],
  [PipelineState.SOURCEPACK_GENERATED]: [PipelineState.QA_PASSED, PipelineState.FAILED],
  [PipelineState.QA_PASSED]: [PipelineState.NOTEBOOK_CREATED, PipelineState.MEDIA_PROMPT_PACK_GENERATED, PipelineState.FAILED],
  [PipelineState.NOTEBOOK_CREATED]: [PipelineState.NOTEBOOK_SOURCES_UPLOADED, PipelineState.FAILED],
  [PipelineState.NOTEBOOK_SOURCES_UPLOADED]: [PipelineState.MEDIA_PROMPT_PACK_GENERATED, PipelineState.FAILED],
  [PipelineState.MEDIA_PROMPT_PACK_GENERATED]: [PipelineState.HEYGEN_SCRIPT_GENERATED, PipelineState.LMS_PUBLISHED, PipelineState.FAILED],
  [PipelineState.HEYGEN_SCRIPT_GENERATED]: [PipelineState.HEYGEN_VIDEO_REQUESTED, PipelineState.FAILED],
  [PipelineState.HEYGEN_VIDEO_REQUESTED]: [PipelineState.HEYGEN_VIDEO_READY, PipelineState.FAILED],
  [PipelineState.HEYGEN_VIDEO_READY]: [PipelineState.LMS_PUBLISHED, PipelineState.FAILED],
  [PipelineState.LMS_PUBLISHED]: [PipelineState.CHAT_CONFIGURED, PipelineState.AUDIT_FINALIZED, PipelineState.FAILED],
  [PipelineState.CHAT_CONFIGURED]: [PipelineState.AUDIT_FINALIZED, PipelineState.FAILED],
  [PipelineState.AUDIT_FINALIZED]: [], // Terminal state
  [PipelineState.FAILED]: [], // Terminal state (but allows resume from checkpoint)
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: PipelineState, to: PipelineState): boolean {
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get the next valid states from a given state
 */
export function getNextValidStates(state: PipelineState): PipelineState[] {
  return VALID_STATE_TRANSITIONS[state] ?? [];
}

/**
 * Check if a state is terminal
 */
export function isTerminalState(state: PipelineState): boolean {
  return VALID_STATE_TRANSITIONS[state]?.length === 0;
}

/**
 * States that can be resumed from
 */
export const RESUMABLE_STATES: PipelineState[] = [
  PipelineState.DRAFT_MODULE_SPEC,
  PipelineState.OUTLINE_GENERATED,
  PipelineState.SOURCEPACK_GENERATED,
  PipelineState.QA_PASSED,
  PipelineState.NOTEBOOK_CREATED,
  PipelineState.NOTEBOOK_SOURCES_UPLOADED,
  PipelineState.MEDIA_PROMPT_PACK_GENERATED,
  PipelineState.HEYGEN_SCRIPT_GENERATED,
  PipelineState.HEYGEN_VIDEO_REQUESTED,
  PipelineState.HEYGEN_VIDEO_READY,
  PipelineState.LMS_PUBLISHED,
  PipelineState.CHAT_CONFIGURED,
];

/**
 * Check if a run can be resumed from a given state
 */
export function canResumeFrom(state: PipelineState): boolean {
  return RESUMABLE_STATES.includes(state);
}

/**
 * States that require artifacts to be present
 */
export const ARTIFACT_REQUIRED_STATES: Record<PipelineState, string[]> = {
  [PipelineState.DRAFT_MODULE_SPEC]: ['moduleSpec'],
  [PipelineState.OUTLINE_GENERATED]: ['moduleSpec', 'outline'],
  [PipelineState.SOURCEPACK_GENERATED]: ['moduleSpec', 'outline', 'sourcepack'],
  [PipelineState.QA_PASSED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport'],
  [PipelineState.NOTEBOOK_CREATED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport'],
  [PipelineState.NOTEBOOK_SOURCES_UPLOADED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport'],
  [PipelineState.MEDIA_PROMPT_PACK_GENERATED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport', 'mediaPromptPack'],
  [PipelineState.HEYGEN_SCRIPT_GENERATED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport', 'mediaPromptPack', 'heygenPackage'],
  [PipelineState.HEYGEN_VIDEO_REQUESTED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport', 'mediaPromptPack', 'heygenPackage'],
  [PipelineState.HEYGEN_VIDEO_READY]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport', 'mediaPromptPack', 'heygenPackage'],
  [PipelineState.LMS_PUBLISHED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport'],
  [PipelineState.CHAT_CONFIGURED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport'],
  [PipelineState.AUDIT_FINALIZED]: ['moduleSpec', 'outline', 'sourcepack', 'qaReport', 'assetManifest'],
  [PipelineState.FAILED]: [],
};
