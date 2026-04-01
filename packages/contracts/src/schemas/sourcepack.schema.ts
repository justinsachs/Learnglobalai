/**
 * Zod schemas for SourcePack validation
 */

import { z } from 'zod';

/**
 * Traceability reference schema
 */
export const TraceabilityReferenceSchema = z.object({
  standardName: z.string().min(1),
  sectionRef: z.string().min(1),
  howAddressed: z.string().min(10),
  relevantExcerpts: z.array(z.string()).optional(),
});

/**
 * Checklist item schema
 */
export const ChecklistItemSchema = z.object({
  order: z.number().int().min(0),
  text: z.string().min(1),
  isCritical: z.boolean().optional(),
  notes: z.string().optional(),
});

/**
 * Embedded checklist schema
 */
export const EmbeddedChecklistSchema = z.object({
  artifactId: z.string().min(1),
  title: z.string().min(1),
  introduction: z.string().min(10),
  items: z.array(ChecklistItemSchema).min(1),
  closingNotes: z.string().optional(),
});

/**
 * Form field schema
 */
export const FormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'signature']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  validationRules: z.string().optional(),
  helpText: z.string().optional(),
});

/**
 * Embedded form schema
 */
export const EmbeddedFormSchema = z.object({
  artifactId: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(10),
  whenToUse: z.string().min(10),
  fields: z.array(FormFieldSchema).min(1),
  instructions: z.string().min(10),
  submissionGuidance: z.string().optional(),
});

/**
 * Dialogue line schema
 */
export const DialogueLineSchema = z.object({
  speaker: z.string().min(1),
  role: z.string().min(1),
  text: z.string().min(1),
  directions: z.string().optional(),
});

/**
 * Embedded scenario schema
 */
export const EmbeddedScenarioSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  setting: z.string().min(10),
  characters: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    description: z.string().min(1),
  })).min(1),
  dialogue: z.array(DialogueLineSchema).min(1),
  narration: z.string().optional(),
  keyLearningPoints: z.array(z.string()).min(1),
  discussionQuestions: z.array(z.string()).optional(),
});

/**
 * Embedded artifact schema
 */
export const EmbeddedArtifactSchema = z.object({
  artifactId: z.string().min(1),
  type: z.enum(['checklist', 'form', 'decision-tree', 'flowchart', 'reference-table', 'scenario-script', 'quiz', 'glossary']),
  title: z.string().min(1),
  content: z.string().min(10),
  structuredData: z.record(z.unknown()).optional(),
});

/**
 * SourcePack section schema (recursive)
 */
export const SourcePackSectionSchema: z.ZodType<{
  id: string;
  level: number;
  heading: string;
  fullProseText: string;
  embeddedScenarios?: z.infer<typeof EmbeddedScenarioSchema>[];
  embeddedChecklists?: z.infer<typeof EmbeddedChecklistSchema>[];
  embeddedForms?: z.infer<typeof EmbeddedFormSchema>[];
  embeddedArtifacts?: z.infer<typeof EmbeddedArtifactSchema>[];
  traceability: z.infer<typeof TraceabilityReferenceSchema>[];
  children?: unknown[];
  wordCount: number;
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    level: z.number().int().min(1).max(6),
    heading: z.string().min(1),
    fullProseText: z.string().min(100, 'Prose text must be at least 100 characters'),
    embeddedScenarios: z.array(EmbeddedScenarioSchema).optional(),
    embeddedChecklists: z.array(EmbeddedChecklistSchema).optional(),
    embeddedForms: z.array(EmbeddedFormSchema).optional(),
    embeddedArtifacts: z.array(EmbeddedArtifactSchema).optional(),
    traceability: z.array(TraceabilityReferenceSchema),
    children: z.array(SourcePackSectionSchema).optional(),
    wordCount: z.number().int().min(0),
  })
);

/**
 * Complete SourcePack schema
 */
export const SourcePackSchema = z.object({
  moduleId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  generatedAt: z.string().datetime(),
  runId: z.string().min(1),
  title: z.string().min(1),
  abstract: z.string().min(50),
  sections: z.array(SourcePackSectionSchema).min(1),
  disclaimers: z.array(z.string()).min(1),
  glossary: z.array(z.object({
    term: z.string().min(1),
    definition: z.string().min(10),
  })).optional(),
  references: z.array(z.object({
    id: z.string().min(1),
    citation: z.string().min(1),
    url: z.string().url().optional(),
  })).optional(),
  totalWordCount: z.number().int().min(0),
  outlineHash: z.string().min(1),
  moduleSpecHash: z.string().min(1),
});

// Type exports
export type TraceabilityReferenceInput = z.infer<typeof TraceabilityReferenceSchema>;
export type EmbeddedChecklistInput = z.infer<typeof EmbeddedChecklistSchema>;
export type EmbeddedFormInput = z.infer<typeof EmbeddedFormSchema>;
export type EmbeddedScenarioInput = z.infer<typeof EmbeddedScenarioSchema>;
export type SourcePackSectionInput = z.infer<typeof SourcePackSectionSchema>;
export type SourcePackInput = z.infer<typeof SourcePackSchema>;
