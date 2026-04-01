/**
 * OpenAPI Schema Definitions for API Routes
 */

export const moduleSchemas = {
  // Request schemas
  CreateModuleBody: {
    type: 'object',
    required: ['title', 'description', 'vertical', 'author', 'spec'],
    properties: {
      title: { type: 'string', description: 'Module title' },
      description: { type: 'string', description: 'Module description' },
      vertical: { type: 'string', description: 'Vertical/brand identifier' },
      author: { type: 'string', description: 'Author email or identifier' },
      spec: {
        type: 'object',
        description: 'Full module specification',
        $ref: '#/components/schemas/ModuleSpec',
      },
    },
  },

  StartRunBody: {
    type: 'object',
    required: ['triggeredBy'],
    properties: {
      triggeredBy: { type: 'string', description: 'User or system that triggered the run' },
      config: {
        type: 'object',
        properties: {
          skipNotebookLm: { type: 'boolean', default: false },
          skipHeygen: { type: 'boolean', default: false },
          skipLmsPublish: { type: 'boolean', default: false },
          skipChat: { type: 'boolean', default: false },
          autoApprove: { type: 'boolean', default: false },
        },
      },
    },
  },

  // Response schemas
  ModuleResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          moduleId: { type: 'string' },
          specId: { type: 'integer' },
          version: { type: 'string' },
        },
      },
    },
  },

  RunResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          runId: { type: 'string' },
          state: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          message: { type: 'string' },
        },
      },
    },
  },

  // Shared schemas
  ModuleSpec: {
    type: 'object',
    required: [
      'moduleId',
      'title',
      'vertical',
      'version',
      'author',
      'targetAudienceRoles',
      'learningObjectives',
      'constraints',
      'safetyBoundaries',
      'mediaPreferences',
    ],
    properties: {
      moduleId: { type: 'string' },
      title: { type: 'string' },
      vertical: { type: 'string' },
      version: { type: 'string' },
      author: { type: 'string' },
      targetAudienceRoles: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
      },
      learningObjectives: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
      },
      standardsMap: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            standardName: { type: 'string' },
            sectionRef: { type: 'string' },
            requirementSummary: { type: 'string' },
          },
        },
      },
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            context: { type: 'string' },
            decisionPoints: { type: 'array' },
          },
        },
      },
      requiredArtifacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['checklist', 'form', 'decision_tree', 'quick_reference', 'infographic'],
            },
            title: { type: 'string' },
            description: { type: 'string' },
            passCriteria: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      constraints: {
        type: 'object',
        properties: {
          minWordsPerMajorHeading: { type: 'integer', minimum: 0 },
          minTotalWords: { type: 'integer', minimum: 0 },
          maxBulletRatio: { type: 'number', minimum: 0, maximum: 1 },
          forbiddenFormattingRules: {
            type: 'array',
            items: { type: 'string' },
          },
          requiredDisclaimers: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      safetyBoundaries: {
        type: 'object',
        properties: {
          scopeOfAdvice: { type: 'string' },
          disclaimers: {
            type: 'array',
            items: { type: 'string' },
          },
          escalationTriggers: {
            type: 'array',
            items: { type: 'string' },
          },
          prohibitedTopics: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      mediaPreferences: {
        type: 'object',
        properties: {
          videoMinutesTarget: { type: 'integer' },
          avatarStyle: { type: 'string' },
          audioTone: { type: 'string' },
          infographicStyle: { type: 'string' },
        },
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },

  PipelineState: {
    type: 'string',
    enum: [
      'DRAFT_MODULE_SPEC',
      'OUTLINE_GENERATED',
      'SOURCEPACK_GENERATED',
      'QA_PASSED',
      'NOTEBOOK_CREATED',
      'NOTEBOOK_SOURCES_UPLOADED',
      'MEDIA_PROMPT_PACK_GENERATED',
      'HEYGEN_SCRIPT_GENERATED',
      'HEYGEN_VIDEO_REQUESTED',
      'HEYGEN_VIDEO_READY',
      'LMS_PUBLISHED',
      'CHAT_CONFIGURED',
      'AUDIT_FINALIZED',
      'FAILED',
    ],
  },

  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { type: 'string' },
      details: { type: 'object' },
    },
  },
};

export const chatSchemas = {
  ChatMessageBody: {
    type: 'object',
    required: ['message', 'sessionId'],
    properties: {
      message: { type: 'string', description: 'User message' },
      conversationId: { type: 'string', description: 'Existing conversation ID to continue' },
      sessionId: { type: 'string', description: 'Session identifier' },
      userId: { type: 'string', description: 'User identifier' },
    },
  },

  ChatResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          conversationId: { type: 'string' },
          content: { type: 'string' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceId: { type: 'string' },
                sourceName: { type: 'string' },
                excerpt: { type: 'string' },
              },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },

  FeedbackBody: {
    type: 'object',
    required: ['rating'],
    properties: {
      rating: {
        type: 'string',
        enum: ['positive', 'negative'],
      },
      comment: { type: 'string' },
    },
  },
};

export const adminSchemas = {
  VerticalConfig: {
    type: 'object',
    properties: {
      verticalId: { type: 'string' },
      name: { type: 'string' },
      config: {
        type: 'object',
        properties: {
          branding: {
            type: 'object',
            properties: {
              primaryColor: { type: 'string' },
              logo: { type: 'string' },
            },
          },
          qualityGates: {
            type: 'object',
            properties: {
              minTotalWords: { type: 'integer' },
              maxBulletRatio: { type: 'number' },
            },
          },
          templates: { type: 'object' },
        },
      },
    },
  },

  AuditEvent: {
    type: 'object',
    properties: {
      eventId: { type: 'string' },
      runId: { type: 'string' },
      moduleId: { type: 'string' },
      eventType: { type: 'string' },
      actor: { type: 'string' },
      fromState: { type: 'string' },
      toState: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      details: { type: 'object' },
    },
  },
};

/**
 * Register schemas with Fastify Swagger
 */
export function registerSchemas(fastify: any): void {
  // Add all schemas to Swagger components
  fastify.addSchema({
    $id: 'ModuleSpec',
    ...moduleSchemas.ModuleSpec,
  });

  fastify.addSchema({
    $id: 'PipelineState',
    ...moduleSchemas.PipelineState,
  });

  fastify.addSchema({
    $id: 'ErrorResponse',
    ...moduleSchemas.ErrorResponse,
  });
}
