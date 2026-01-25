/**
 * Zod schemas for Outline validation
 */

import { z } from 'zod';

/**
 * Heading mapping schema
 */
export const HeadingMappingSchema = z.object({
  learningObjectiveIndices: z.array(z.number().int().min(0)),
  standardRefs: z.array(z.string()),
  artifactIds: z.array(z.string()).optional(),
  scenarioIds: z.array(z.string()).optional(),
});

/**
 * Outline heading schema (recursive)
 */
export const OutlineHeadingSchema: z.ZodType<{
  id: string;
  level: number;
  title: string;
  description: string;
  mapping: z.infer<typeof HeadingMappingSchema>;
  children: unknown[];
  estimatedWordCount?: number;
  order: number;
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    level: z.number().int().min(1).max(6),
    title: z.string().min(1).max(500),
    description: z.string().min(10),
    mapping: HeadingMappingSchema,
    children: z.array(OutlineHeadingSchema),
    estimatedWordCount: z.number().int().min(0).optional(),
    order: z.number().int().min(0),
  })
);

/**
 * Complete Outline schema
 */
export const OutlineSchema = z.object({
  moduleId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  generatedAt: z.string().datetime(),
  runId: z.string().min(1),
  headings: z.array(OutlineHeadingSchema).min(1, 'At least one heading required'),
  summary: z.string().min(50),
  totalEstimatedWordCount: z.number().int().min(0),
  validationNotes: z.array(z.string()).optional(),
  moduleSpecHash: z.string().min(1),
});

// Type exports
export type HeadingMappingInput = z.infer<typeof HeadingMappingSchema>;
export type OutlineHeadingInput = z.infer<typeof OutlineHeadingSchema>;
export type OutlineInput = z.infer<typeof OutlineSchema>;
