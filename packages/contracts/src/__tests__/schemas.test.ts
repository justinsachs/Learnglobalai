/**
 * Schema Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ModuleSpecSchema,
  OutlineSchema,
  SourcePackSchema,
  QAReportSchema,
} from '../schemas/index.js';

describe('ModuleSpecSchema', () => {
  const validModuleSpec = {
    moduleId: 'mod-001',
    title: 'Respiratory Protection Training',
    vertical: 'medviro',
    version: '1.0.0',
    author: 'author@example.com',
    targetAudienceRoles: ['tech', 'supervisor'],
    learningObjectives: [
      'Understand respiratory hazards',
      'Select appropriate respirators',
    ],
    standardsMap: [
      {
        standardName: 'OSHA 1910.134',
        sectionRef: '(c)',
        requirementSummary: 'Respiratory protection program requirements',
      },
    ],
    scenarios: [
      {
        id: 'scenario-1',
        title: 'Selecting a Respirator',
        context: 'Worker needs to select appropriate PPE',
        decisionPoints: [
          {
            question: 'What type of respirator is needed?',
            correctAnswer: 'N95',
            incorrectAnswers: ['Surgical mask', 'Cloth mask'],
            explanation: 'N95 provides proper filtration',
          },
        ],
      },
    ],
    requiredArtifacts: [
      {
        id: 'checklist-1',
        type: 'checklist',
        title: 'Daily Inspection Checklist',
        description: 'Checklist for daily respirator inspection',
        passCriteria: ['Has at least 5 items', 'Covers seal check'],
      },
    ],
    constraints: {
      minWordsPerMajorHeading: 500,
      minTotalWords: 3000,
      maxBulletRatio: 0.08,
      forbiddenFormattingRules: ['No all caps headings'],
      requiredDisclaimers: ['This training does not replace medical advice'],
    },
    safetyBoundaries: {
      scopeOfAdvice: 'Occupational respiratory protection only',
      disclaimers: ['Consult your supervisor for specific situations'],
      escalationTriggers: ['medical emergency', 'serious injury'],
      prohibitedTopics: ['medical diagnosis', 'legal advice'],
    },
    mediaPreferences: {
      videoMinutesTarget: 15,
      avatarStyle: 'professional',
      audioTone: 'instructional',
      infographicStyle: 'technical',
    },
  };

  it('should validate a complete module spec', () => {
    const result = ModuleSpecSchema.safeParse(validModuleSpec);
    expect(result.success).toBe(true);
  });

  it('should require moduleId', () => {
    const invalid = { ...validModuleSpec, moduleId: undefined };
    const result = ModuleSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require at least one learning objective', () => {
    const invalid = { ...validModuleSpec, learningObjectives: [] };
    const result = ModuleSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate artifact types', () => {
    const invalidArtifact = {
      ...validModuleSpec,
      requiredArtifacts: [
        {
          id: 'artifact-1',
          type: 'invalid_type', // Invalid type
          title: 'Test',
          description: 'Test',
          passCriteria: [],
        },
      ],
    };
    const result = ModuleSpecSchema.safeParse(invalidArtifact);
    expect(result.success).toBe(false);
  });

  it('should validate constraints are positive numbers', () => {
    const invalid = {
      ...validModuleSpec,
      constraints: {
        ...validModuleSpec.constraints,
        minTotalWords: -100, // Invalid negative
      },
    };
    const result = ModuleSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate maxBulletRatio is between 0 and 1', () => {
    const invalid = {
      ...validModuleSpec,
      constraints: {
        ...validModuleSpec.constraints,
        maxBulletRatio: 1.5, // Invalid > 1
      },
    };
    const result = ModuleSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('OutlineSchema', () => {
  const validOutline = {
    moduleId: 'mod-001',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    headings: [
      {
        id: 'h1',
        level: 1,
        text: 'Introduction',
        children: [
          {
            id: 'h1-1',
            level: 2,
            text: 'Overview',
            children: [],
          },
        ],
      },
    ],
    objectiveMapping: [
      {
        objectiveId: 'obj-1',
        objective: 'Understand respiratory hazards',
        headingIds: ['h1', 'h1-1'],
      },
    ],
    standardsMapping: [
      {
        standardName: 'OSHA 1910.134',
        sectionRef: '(c)',
        headingIds: ['h1'],
      },
    ],
    estimatedWordCount: 5000,
  };

  it('should validate a complete outline', () => {
    const result = OutlineSchema.safeParse(validOutline);
    expect(result.success).toBe(true);
  });

  it('should require headings', () => {
    const invalid = { ...validOutline, headings: [] };
    const result = OutlineSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate heading levels are 1-6', () => {
    const invalid = {
      ...validOutline,
      headings: [{ id: 'h1', level: 7, text: 'Invalid', children: [] }],
    };
    const result = OutlineSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require positive estimated word count', () => {
    const invalid = { ...validOutline, estimatedWordCount: 0 };
    const result = OutlineSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('SourcePackSchema', () => {
  const validSourcePack = {
    moduleId: 'mod-001',
    version: '1.0.0',
    runId: 'run-001',
    title: 'Respiratory Protection Training Manual',
    generatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-1',
        heading: 'Introduction to Respiratory Protection',
        fullProseText: 'This comprehensive guide provides detailed information about respiratory protection in the workplace. It covers all aspects of selecting, using, and maintaining respiratory protective equipment.',
        wordCount: 500,
        traceability: [
          {
            standardName: 'OSHA 1910.134',
            sectionRef: '(c)',
            how: 'Addresses program requirements',
          },
        ],
        embeddedScenarios: [],
        embeddedChecklists: [],
        embeddedForms: [],
        embeddedArtifacts: [],
        children: [],
      },
    ],
    glossary: [
      {
        term: 'APF',
        definition: 'Assigned Protection Factor',
      },
    ],
    references: [
      {
        id: 'ref-1',
        citation: 'OSHA 1910.134 - Respiratory Protection Standard',
        url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.134',
      },
    ],
    disclaimers: ['This training is for educational purposes only.'],
    totalWordCount: 500,
  };

  it('should validate a complete source pack', () => {
    const result = SourcePackSchema.safeParse(validSourcePack);
    expect(result.success).toBe(true);
  });

  it('should require at least one section', () => {
    const invalid = { ...validSourcePack, sections: [] };
    const result = SourcePackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require fullProseText for sections', () => {
    const invalid = {
      ...validSourcePack,
      sections: [{ ...validSourcePack.sections[0], fullProseText: '' }],
    };
    const result = SourcePackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require positive word counts', () => {
    const invalid = {
      ...validSourcePack,
      sections: [{ ...validSourcePack.sections[0], wordCount: -1 }],
    };
    const result = SourcePackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('QAReportSchema', () => {
  const validQAReport = {
    moduleId: 'mod-001',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    runId: 'run-001',
    sourcePackHash: 'sha256-abc123',
    moduleSpecHash: 'sha256-def456',
    wordCounts: {
      perSection: [
        {
          sectionId: 'sec-1',
          heading: 'Introduction',
          wordCount: 5000,
          meetsMinimum: true,
          requiredMinimum: 500,
        },
      ],
      total: 5000,
      requiredMinimum: 3000,
      totalMeetsMinimum: true,
    },
    formatting: {
      totalLines: 100,
      bulletLines: 5,
      numberedLines: 3,
      bulletRatio: 0.08,
      bulletRatioAcceptable: true,
      bulletRatioThreshold: 0.08,
      forbiddenFormattingViolations: [],
    },
    artifactValidation: [
      {
        artifactId: 'checklist-1',
        type: 'checklist',
        found: true,
        foundInSection: 'sec-1',
        criteriaResults: [
          { criterion: 'Has at least 5 items', passed: true },
        ],
        passed: true,
      },
    ],
    standardsCoverage: [
      {
        standardName: 'OSHA 1910.134',
        sectionRef: '(c)',
        covered: true,
        markedNotApplicable: false,
        addressedInSections: ['sec-1'],
        coverageQuality: 'comprehensive',
      },
    ],
    disclaimerValidation: [
      {
        requiredDisclaimer: 'Educational purposes only',
        found: true,
        location: 'disclaimers',
      },
    ],
    scopeBoundaryValidation: {
      scopeStatementFound: true,
      escalationTriggersMentioned: true,
      prohibitedTopicViolations: [],
      sensitiveTopicsHandled: true,
    },
    failures: [],
    warnings: [],
    summary: {
      totalChecks: 10,
      passedChecks: 10,
      failedChecks: 0,
      warningCount: 0,
    },
    passed: true,
    failureReasons: [],
    recommendations: [],
  };

  it('should validate a passing QA report', () => {
    const result = QAReportSchema.safeParse(validQAReport);
    expect(result.success).toBe(true);
  });

  it('should validate a failing QA report', () => {
    const failingReport = {
      ...validQAReport,
      passed: false,
      failures: [
        {
          category: 'word_count',
          severity: 'error',
          message: 'Total word count below minimum',
          details: { total: 1000, required: 3000 },
          suggestedFix: 'Add more content',
        },
      ],
      failureReasons: ['Total word count below minimum'],
    };
    const result = QAReportSchema.safeParse(failingReport);
    expect(result.success).toBe(true);
    expect(result.data?.passed).toBe(false);
  });

  it('should require summary counts to be non-negative', () => {
    const invalid = {
      ...validQAReport,
      summary: {
        ...validQAReport.summary,
        failedChecks: -1,
      },
    };
    const result = QAReportSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
