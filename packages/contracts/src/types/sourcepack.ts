/**
 * SourcePack - Full prose content for the training module
 * This is the primary content artifact used for NotebookLM ingestion
 *
 * IMPORTANT: SourcePack must contain FULL PROSE, not outlines or bullet points.
 * The content should be suitable for professional training material and
 * comprehensive enough for NotebookLM to generate quality audio/video content.
 */

import type { ModuleId, Version, Timestamp, Hash, ArtifactType } from './base.js';

/**
 * Traceability reference linking content to standards
 */
export interface TraceabilityReference {
  /** Standard name */
  standardName: string;
  /** Section reference */
  sectionRef: string;
  /** How this section addresses the standard */
  howAddressed: string;
  /** Direct quotes or paraphrases from the standard */
  relevantExcerpts?: string[];
}

/**
 * Embedded checklist item
 */
export interface ChecklistItem {
  /** Order in the checklist */
  order: number;
  /** Item text */
  text: string;
  /** Whether this is a critical item */
  isCritical?: boolean;
  /** Notes or guidance */
  notes?: string;
}

/**
 * Embedded checklist within content
 */
export interface EmbeddedChecklist {
  /** Artifact ID from ModuleSpec */
  artifactId: string;
  /** Checklist title */
  title: string;
  /** Introduction text */
  introduction: string;
  /** Checklist items */
  items: ChecklistItem[];
  /** Closing notes */
  closingNotes?: string;
}

/**
 * Embedded form field
 */
export interface FormField {
  /** Field ID */
  id: string;
  /** Field label */
  label: string;
  /** Field type */
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'signature';
  /** Whether the field is required */
  required: boolean;
  /** Options for select fields */
  options?: string[];
  /** Validation rules in plain text */
  validationRules?: string;
  /** Help text */
  helpText?: string;
}

/**
 * Embedded form specification
 */
export interface EmbeddedForm {
  /** Artifact ID from ModuleSpec */
  artifactId: string;
  /** Form title */
  title: string;
  /** Form purpose description */
  purpose: string;
  /** When to use this form */
  whenToUse: string;
  /** Form fields */
  fields: FormField[];
  /** Instructions for completing */
  instructions: string;
  /** Submission guidance */
  submissionGuidance?: string;
}

/**
 * Dialogue line in a scenario script
 */
export interface DialogueLine {
  /** Speaker identifier */
  speaker: string;
  /** Speaker's role */
  role: string;
  /** The dialogue text */
  text: string;
  /** Stage directions or context */
  directions?: string;
}

/**
 * Embedded scenario script (narrative vignette)
 */
export interface EmbeddedScenario {
  /** Scenario ID from ModuleSpec */
  scenarioId: string;
  /** Scenario title */
  title: string;
  /** Setting description */
  setting: string;
  /** Characters involved */
  characters: Array<{
    name: string;
    role: string;
    description: string;
  }>;
  /** The script as dialogue */
  dialogue: DialogueLine[];
  /** Narrator commentary */
  narration?: string;
  /** Key learning points demonstrated */
  keyLearningPoints: string[];
  /** Discussion questions for after */
  discussionQuestions?: string[];
}

/**
 * Generic embedded artifact
 */
export interface EmbeddedArtifact {
  /** Artifact ID from ModuleSpec */
  artifactId: string;
  /** Artifact type */
  type: ArtifactType;
  /** Title */
  title: string;
  /** Full content/specification */
  content: string;
  /** Structured data if applicable */
  structuredData?: Record<string, unknown>;
}

/**
 * A section of the SourcePack
 */
export interface SourcePackSection {
  /** Section ID (matches outline heading ID) */
  id: string;

  /** Heading level */
  level: number;

  /** Section heading */
  heading: string;

  /**
   * Full prose text content
   * This must be complete, professional prose - NOT outlines or bullet lists.
   * Minimum word count requirements apply here.
   */
  fullProseText: string;

  /** Embedded scenario scripts */
  embeddedScenarios?: EmbeddedScenario[];

  /** Embedded checklists */
  embeddedChecklists?: EmbeddedChecklist[];

  /** Embedded forms */
  embeddedForms?: EmbeddedForm[];

  /** Other embedded artifacts */
  embeddedArtifacts?: EmbeddedArtifact[];

  /** Traceability to standards */
  traceability: TraceabilityReference[];

  /** Child sections */
  children?: SourcePackSection[];

  /** Word count for this section (prose only, excluding embedded artifacts) */
  wordCount: number;
}

/**
 * Complete SourcePack structure
 */
export interface SourcePack {
  /** Module ID */
  moduleId: ModuleId;

  /** Version */
  version: Version;

  /** Generation timestamp */
  generatedAt: Timestamp;

  /** Run ID that generated this */
  runId: string;

  /** Module title */
  title: string;

  /** Module description/abstract */
  abstract: string;

  /** Sections of content */
  sections: SourcePackSection[];

  /** Global disclaimers (appear at start/end) */
  disclaimers: string[];

  /** Glossary of terms */
  glossary?: Array<{
    term: string;
    definition: string;
  }>;

  /** References/bibliography */
  references?: Array<{
    id: string;
    citation: string;
    url?: string;
  }>;

  /** Total word count (prose only) */
  totalWordCount: number;

  /** Hash of the outline used */
  outlineHash: Hash;

  /** Hash of the ModuleSpec used */
  moduleSpecHash: Hash;
}

/**
 * Markdown export of SourcePack
 * This is what gets uploaded to NotebookLM
 */
export interface SourcePackMarkdown {
  /** The complete markdown content */
  content: string;
  /** Metadata header */
  frontmatter: {
    moduleId: ModuleId;
    version: Version;
    title: string;
    generatedAt: Timestamp;
    runId: string;
  };
}
