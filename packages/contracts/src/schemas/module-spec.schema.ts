/**
 * Zod schemas for ModuleSpec validation
 */

import { z } from 'zod';

/**
 * Standard reference schema
 */
export const StandardReferenceSchema = z.object({
  standardName: z.string().min(1, 'Standard name is required'),
  sectionRef: z.string().min(1, 'Section reference is required'),
  requirementSummary: z.string().min(10, 'Requirement summary must be at least 10 characters'),
  fullText: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

/**
 * Decision point schema
 */
export const DecisionPointSchema = z.object({
  id: z.string().min(1),
  situation: z.string().min(10, 'Situation must be at least 10 characters'),
  options: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    isCorrect: z.boolean(),
    explanation: z.string().min(1),
  })).min(2, 'At least 2 options required'),
  consequences: z.string().optional(),
});

/**
 * Scenario schema
 */
export const ScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  context: z.string().min(20, 'Context must be at least 20 characters'),
  learnerRole: z.string().optional(),
  decisionPoints: z.array(DecisionPointSchema).min(1, 'At least one decision point required'),
  objectivesAddressed: z.array(z.string()).optional(),
  standardsAddressed: z.array(z.string()).optional(),
});

/**
 * Required artifact schema
 */
export const RequiredArtifactSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['checklist', 'form', 'decision-tree', 'flowchart', 'reference-table', 'scenario-script', 'quiz', 'glossary']),
  description: z.string().min(10),
  passCriteria: z.array(z.string()).min(1, 'At least one pass criterion required'),
  targetSection: z.string().optional(),
});

/**
 * Content constraints schema
 */
export const ContentConstraintsSchema = z.object({
  minWordsPerMajorHeading: z.number().int().min(100).max(10000),
  minTotalWords: z.number().int().min(1000).max(100000),
  maxBulletRatio: z.number().min(0).max(1),
  forbiddenFormattingRules: z.array(z.string()),
  requiredDisclaimers: z.array(z.string()),
  requiredSections: z.array(z.string()).optional(),
});

/**
 * Safety boundaries schema
 */
export const SafetyBoundariesSchema = z.object({
  scopeOfAdvice: z.string().min(20, 'Scope of advice must be at least 20 characters'),
  disclaimers: z.array(z.string()).min(1, 'At least one disclaimer required'),
  escalationTriggers: z.array(z.string()),
  prohibitedTopics: z.array(z.string()).optional(),
  sensitiveTopics: z.array(z.string()).optional(),
});

/**
 * Media preferences schema
 */
export const MediaPreferencesSchema = z.object({
  videoMinutesTarget: z.number().min(1).max(60),
  avatarStyle: z.string().min(1),
  audioTone: z.string().min(1),
  infographicStyle: z.string().min(1),
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }).optional(),
  backgroundMusic: z.enum(['none', 'subtle', 'moderate']).optional(),
  pacing: z.enum(['slow', 'moderate', 'fast']).optional(),
});

/**
 * Complete ModuleSpec schema
 */
export const ModuleSpecSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(3).max(200),
  vertical: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),
  author: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  description: z.string().min(20).max(2000),
  targetAudienceRoles: z.array(z.string()).min(1, 'At least one target audience role required'),
  learningObjectives: z.array(z.string().min(10)).min(1, 'At least one learning objective required'),
  standardsMap: z.array(StandardReferenceSchema),
  scenarios: z.array(ScenarioSchema),
  requiredArtifacts: z.array(RequiredArtifactSchema),
  constraints: ContentConstraintsSchema,
  safetyBoundaries: SafetyBoundariesSchema,
  mediaPreferences: MediaPreferencesSchema,
  prerequisites: z.array(z.string()).optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(480).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * ModuleSpec input schema (for creation)
 */
export const ModuleSpecInputSchema = ModuleSpecSchema.omit({
  moduleId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type StandardReferenceInput = z.infer<typeof StandardReferenceSchema>;
export type DecisionPointInput = z.infer<typeof DecisionPointSchema>;
export type ScenarioInput = z.infer<typeof ScenarioSchema>;
export type RequiredArtifactInput = z.infer<typeof RequiredArtifactSchema>;
export type ContentConstraintsInput = z.infer<typeof ContentConstraintsSchema>;
export type SafetyBoundariesInput = z.infer<typeof SafetyBoundariesSchema>;
export type MediaPreferencesInput = z.infer<typeof MediaPreferencesSchema>;
export type ModuleSpecInput = z.infer<typeof ModuleSpecInputSchema>;
