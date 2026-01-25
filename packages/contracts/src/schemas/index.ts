/**
 * LearnGlobal.ai Validation Schemas
 * Central export for all Zod schemas
 */

export * from './module-spec.schema.js';
export * from './outline.schema.js';
export * from './sourcepack.schema.js';
export * from './qa-report.schema.js';

// Re-export validation utilities
import { z } from 'zod';

/**
 * Validate data against a schema and return typed result
 */
export function validateSchema<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for human-readable output
 */
export function formatZodErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Create a partial schema from a full schema
 */
export function createPartialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}
