/**
 * Outline - Hierarchical structure for the training module
 * Generated from ModuleSpec, used to guide SourcePack generation
 */

import type { ModuleId, Version, Timestamp } from './base.js';

/**
 * Mapping of a heading to learning objectives and standards
 */
export interface HeadingMapping {
  /** Learning objective IDs addressed in this section */
  learningObjectiveIndices: number[];
  /** Standard references covered in this section */
  standardRefs: string[];
  /** Artifacts that should appear in this section */
  artifactIds?: string[];
  /** Scenarios to include in this section */
  scenarioIds?: string[];
}

/**
 * A heading in the outline hierarchy
 */
export interface OutlineHeading {
  /** Unique ID for this heading */
  id: string;
  /** Heading level (1 = top level, 2 = subheading, etc.) */
  level: number;
  /** The heading text */
  title: string;
  /** Brief description of what this section will cover */
  description: string;
  /** Mapping to objectives, standards, and artifacts */
  mapping: HeadingMapping;
  /** Child headings */
  children: OutlineHeading[];
  /** Estimated word count for this section */
  estimatedWordCount?: number;
  /** Order within parent */
  order: number;
}

/**
 * Complete Outline structure
 */
export interface Outline {
  /** Module ID this outline belongs to */
  moduleId: ModuleId;

  /** Version of the outline */
  version: Version;

  /** Generation timestamp */
  generatedAt: Timestamp;

  /** Run ID that generated this outline */
  runId: string;

  /** Root-level headings */
  headings: OutlineHeading[];

  /** Summary of the outline */
  summary: string;

  /** Total estimated word count */
  totalEstimatedWordCount: number;

  /** Validation notes from generation */
  validationNotes?: string[];

  /** Hash of the ModuleSpec used to generate this */
  moduleSpecHash: string;
}

/**
 * Flattened heading for easier processing
 */
export interface FlattenedHeading {
  id: string;
  level: number;
  title: string;
  path: string; // e.g., "1.2.3"
  fullTitle: string; // e.g., "1.2.3 Section Title"
  mapping: HeadingMapping;
  parentId?: string;
}

/**
 * Utility function type for flattening outlines
 */
export type FlattenOutline = (outline: Outline) => FlattenedHeading[];
