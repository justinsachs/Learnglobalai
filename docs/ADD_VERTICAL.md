# How to Add a New Vertical

This guide explains how to add a new brand/vertical to the LearnGlobal.ai system. A vertical represents a distinct business unit or brand with its own branding, content requirements, and configuration.

## Overview

Adding a new vertical involves:

1. Creating a vertical configuration
2. Setting up brand-specific templates
3. Configuring LLM prompts
4. Defining quality gate thresholds
5. Setting up connectors (optional)
6. Testing the vertical

## Step 1: Create Vertical Configuration

### Database Entry

Insert a new vertical configuration into the database:

```sql
INSERT INTO vertical_configs (
  id,
  vertical_id,
  name,
  config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'response-roofing',
  'Response Roofing',
  '{
    "branding": {
      "primaryColor": "#FF6600",
      "secondaryColor": "#333333",
      "logo": "https://cdn.example.com/response-roofing-logo.png",
      "companyName": "Response Roofing Training",
      "tagline": "Safety First, Quality Always"
    },
    "defaultConstraints": {
      "minWordCount": 2500,
      "maxBulletRatio": 0.25,
      "readingLevel": "grade-10",
      "requiredSections": ["safety", "procedures", "compliance"]
    },
    "llmConfig": {
      "provider": "openai",
      "model": "gpt-4-turbo",
      "temperature": 0.7,
      "maxTokens": 8000
    },
    "connectors": {
      "lms": {
        "provider": "canvas",
        "baseUrl": "https://roofing.instructure.com",
        "accountId": "12345"
      },
      "storage": {
        "bucket": "response-roofing-content",
        "prefix": "modules/"
      }
    },
    "qualityGates": {
      "minStandardsCoverage": 0.95,
      "requireSafetySection": true,
      "requireComplianceSignoff": true
    }
  }'::jsonb,
  NOW(),
  NOW()
);
```

### Via API

```bash
curl -X POST http://localhost:3000/api/admin/verticals \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verticalId": "response-roofing",
    "name": "Response Roofing",
    "config": {
      "branding": {
        "primaryColor": "#FF6600",
        "logo": "https://cdn.example.com/logo.png"
      }
    }
  }'
```

## Step 2: Create Brand-Specific Templates

### Prompt Templates

Create prompt templates for the vertical in `packages/llm/src/templates/`:

```typescript
// packages/llm/src/templates/response-roofing.ts

export const responseRoofingTemplates = {
  outline: `
You are creating a training module outline for Response Roofing, a professional roofing contractor training program.

BRAND VOICE:
- Professional but approachable
- Safety-focused with practical application
- Industry-specific terminology (explain when first used)
- Emphasize hands-on skills and real-world scenarios

MODULE SPECIFICATION:
{moduleSpec}

Create a detailed outline that:
1. Addresses all learning objectives
2. Maps to relevant OSHA and industry standards
3. Includes practical exercises for each major topic
4. Incorporates safety checkpoints throughout

OUTPUT FORMAT:
{outlineSchema}
`,

  sourcepack: `
You are writing comprehensive training content for Response Roofing.

CRITICAL REQUIREMENTS:
- Write in full prose paragraphs, NOT bullet points
- Minimum 3000 words per section
- Include specific examples from roofing industry
- Reference relevant OSHA standards (29 CFR 1926)
- Include safety warnings prominently

OUTLINE TO EXPAND:
{outline}

STANDARDS TO COVER:
{standards}

Write complete, publication-ready content that a roofing professional can immediately apply on the job site.
`,

  mediaPrompts: `
Create media generation prompts for Response Roofing training content.

BRAND GUIDELINES:
- Use orange (#FF6600) as accent color
- Include diverse workers in safety gear
- Show realistic job site environments
- Emphasize proper PPE usage

CONTENT:
{sourcepack}

Generate prompts for:
1. Presenter video scripts (professional, authoritative tone)
2. Infographic descriptions (clear, visual learning aids)
3. Audio narration scripts (conversational but professional)
`
};
```

### Register Templates

Update the template registry in `packages/llm/src/templates/index.ts`:

```typescript
import { responseRoofingTemplates } from './response-roofing';

export const verticalTemplates: Record<string, VerticalTemplates> = {
  'medviro': medviroTemplates,
  'clearclaims': clearchaimsTemplates,
  'response-roofing': responseRoofingTemplates,  // Add new vertical
};

export function getTemplatesForVertical(verticalId: string): VerticalTemplates {
  return verticalTemplates[verticalId] || defaultTemplates;
}
```

## Step 3: Define Standards Mapping

Create a standards reference file for the vertical:

```typescript
// packages/contracts/src/standards/response-roofing.ts

export const responseRoofingStandards: StandardReference[] = [
  {
    id: 'osha-1926-500',
    code: '29 CFR 1926.500',
    title: 'Fall Protection - Scope and Definitions',
    url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.500',
    sections: [
      { id: '500-a', title: 'Scope', required: true },
      { id: '500-b', title: 'Definitions', required: true }
    ]
  },
  {
    id: 'osha-1926-501',
    code: '29 CFR 1926.501',
    title: 'Fall Protection - Duty to Have Fall Protection',
    url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.501',
    sections: [
      { id: '501-b-10', title: 'Roofing work on low-slope roofs', required: true },
      { id: '501-b-11', title: 'Steep roofs', required: true },
      { id: '501-b-13', title: 'Residential construction', required: true }
    ]
  },
  {
    id: 'osha-1926-502',
    code: '29 CFR 1926.502',
    title: 'Fall Protection - Fall Protection Systems Criteria',
    url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.502',
    sections: [
      { id: '502-d', title: 'Personal fall arrest systems', required: true },
      { id: '502-e', title: 'Positioning device systems', required: false }
    ]
  },
  {
    id: 'nrca-guidelines',
    code: 'NRCA Safety Manual',
    title: 'National Roofing Contractors Association Safety Guidelines',
    url: 'https://www.nrca.net/safety',
    sections: [
      { id: 'ladder-safety', title: 'Ladder Safety', required: true },
      { id: 'tool-safety', title: 'Power Tool Safety', required: true }
    ]
  }
];
```

## Step 4: Configure Quality Gates

Define vertical-specific quality gates:

```typescript
// packages/orchestrator/src/quality-gates/response-roofing.ts

export const responseRoofingQualityGates: QualityGateConfig = {
  // Content quality
  minWordCount: 2500,
  maxBulletRatio: 0.25,
  readingLevelRange: { min: 8, max: 12 },

  // Standards coverage
  requiredStandards: [
    'osha-1926-500',
    'osha-1926-501',
    'osha-1926-502'
  ],
  minStandardsCoverage: 0.95,

  // Safety requirements
  requireSafetySection: true,
  safetyKeywords: [
    'fall protection',
    'personal protective equipment',
    'PPE',
    'harness',
    'anchor point',
    'weather conditions'
  ],
  minSafetyKeywordDensity: 0.02, // 2% of content

  // Artifact requirements
  requiredArtifacts: [
    'safety-checklist',
    'equipment-inspection-form',
    'incident-report-template'
  ],

  // Scenario requirements
  minScenarios: 3,
  scenarioTypes: ['safety-incident', 'decision-point', 'compliance-check']
};
```

## Step 5: Set Up Connectors (Optional)

### Custom LMS Integration

If the vertical uses a different LMS:

```typescript
// packages/connectors/src/lms/canvas.ts

export class CanvasLmsConnector implements LmsConnector {
  constructor(private config: CanvasConfig) {}

  async createCourse(module: Module): Promise<LmsCourse> {
    const response = await fetch(`${this.config.baseUrl}/api/v1/courses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        course: {
          name: module.title,
          course_code: module.id,
          account_id: this.config.accountId
        }
      })
    });

    return this.mapToCourse(await response.json());
  }

  async uploadContent(courseId: string, content: ContentPackage): Promise<void> {
    // Implementation for Canvas-specific content upload
  }

  async publishCourse(courseId: string): Promise<void> {
    await fetch(`${this.config.baseUrl}/api/v1/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
      body: JSON.stringify({ course: { event: 'offer' } })
    });
  }
}
```

### Register Connector

```typescript
// packages/connectors/src/lms/index.ts

export function createLmsConnector(verticalConfig: VerticalConfig): LmsConnector {
  const lmsConfig = verticalConfig.config.connectors?.lms;

  switch (lmsConfig?.provider) {
    case 'canvas':
      return new CanvasLmsConnector(lmsConfig);
    case 'moodle':
      return new MoodleLmsConnector(lmsConfig);
    case 'filesystem':
    default:
      return new FileSystemLmsConnector(lmsConfig);
  }
}
```

## Step 6: Create Sample Module Spec

Create a sample module specification for testing:

```json
// samples/response-roofing-module-spec.json
{
  "moduleId": "rr-fall-protection-101",
  "verticalId": "response-roofing",
  "title": "Fall Protection Fundamentals for Roofing Professionals",
  "description": "Comprehensive training on OSHA-compliant fall protection systems",
  "version": "1.0.0",
  "learningObjectives": [
    "Identify fall hazards on residential and commercial roofing projects",
    "Select appropriate fall protection systems based on roof type and pitch",
    "Properly inspect, don, and use personal fall arrest systems",
    "Understand employer and employee responsibilities under OSHA 1926 Subpart M",
    "Respond appropriately to fall incidents and near-misses"
  ],
  "standardsMapping": [
    {
      "standardId": "osha-1926-501",
      "sections": ["501-b-10", "501-b-11", "501-b-13"],
      "required": true
    },
    {
      "standardId": "osha-1926-502",
      "sections": ["502-d"],
      "required": true
    }
  ],
  "scenarios": [
    {
      "id": "scenario-steep-roof",
      "title": "Working on a Steep Slope Roof",
      "description": "You're assigned to repair shingles on a 8:12 pitch residential roof",
      "decisionPoints": [
        {
          "question": "What fall protection system is required?",
          "correctAnswer": "Personal fall arrest system with anchor meeting 5000 lb requirement",
          "incorrectAnswers": [
            "Warning line system only",
            "Safety monitor system",
            "No fall protection needed under 6 feet"
          ],
          "explanation": "OSHA 1926.501(b)(11) requires personal fall arrest, guardrails, or safety nets on steep roofs"
        }
      ]
    }
  ],
  "requiredArtifacts": [
    {
      "type": "checklist",
      "id": "daily-harness-inspection",
      "title": "Daily Harness Inspection Checklist"
    },
    {
      "type": "form",
      "id": "fall-protection-plan",
      "title": "Site-Specific Fall Protection Plan"
    }
  ],
  "constraints": {
    "minWordCount": 2500,
    "maxBulletRatio": 0.25
  },
  "safetyBoundaries": {
    "forbiddenTopics": ["shortcuts", "workarounds"],
    "requiredDisclaimers": [
      "Always follow your employer's site-specific fall protection plan",
      "This training does not replace hands-on competent person training"
    ]
  }
}
```

## Step 7: Test the Vertical

### Run Integration Tests

```bash
# Test vertical configuration loading
npm run test -- --grep "response-roofing"

# Test template rendering
npm run test:templates -- --vertical response-roofing

# Test quality gates
npm run test:qa -- --vertical response-roofing
```

### Create Test Module

```bash
# Create module via API
curl -X POST http://localhost:3000/api/modules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verticalId": "response-roofing",
    "title": "Test Module",
    "description": "Testing new vertical"
  }'

# Submit spec
curl -X POST http://localhost:3000/api/modules/{moduleId}/spec \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @samples/response-roofing-module-spec.json

# Start pipeline run
curl -X POST http://localhost:3000/api/modules/{moduleId}/runs \
  -H "Authorization: Bearer $TOKEN"

# Monitor progress
curl http://localhost:3000/api/runs/{runId} \
  -H "Authorization: Bearer $TOKEN"
```

### Validate Output

1. Check generated outline matches brand voice
2. Verify sourcepack meets word count requirements
3. Confirm standards coverage in QA report
4. Review media prompts for brand consistency
5. Validate LMS publish (if configured)

## Vertical Configuration Reference

### Full Configuration Schema

```typescript
interface VerticalConfig {
  verticalId: string;
  name: string;
  config: {
    branding: {
      primaryColor: string;
      secondaryColor?: string;
      logo: string;
      companyName: string;
      tagline?: string;
      fonts?: {
        heading: string;
        body: string;
      };
    };

    defaultConstraints: {
      minWordCount: number;
      maxBulletRatio: number;
      readingLevel?: string;
      requiredSections?: string[];
      forbiddenContent?: string[];
    };

    llmConfig: {
      provider: 'openai' | 'anthropic' | 'azure';
      model: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    };

    connectors: {
      lms?: {
        provider: string;
        baseUrl: string;
        apiKey?: string;
        accountId?: string;
      };
      storage?: {
        bucket: string;
        prefix?: string;
        region?: string;
      };
      heygen?: {
        avatarId: string;
        voiceId: string;
        backgroundId?: string;
      };
    };

    qualityGates: {
      minStandardsCoverage: number;
      requireSafetySection?: boolean;
      requireComplianceSignoff?: boolean;
      customValidators?: string[];
    };

    chat?: {
      systemPrompt: string;
      forbiddenTopics: string[];
      escalationKeywords: string[];
      maxResponseLength: number;
    };
  };
}
```

## Checklist

- [ ] Database entry created
- [ ] Prompt templates created and registered
- [ ] Standards mapping defined
- [ ] Quality gates configured
- [ ] LMS connector set up (if needed)
- [ ] Sample module spec created
- [ ] Integration tests passing
- [ ] Test pipeline run completed successfully
- [ ] Content quality reviewed
- [ ] Documentation updated
