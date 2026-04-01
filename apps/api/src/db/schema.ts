/**
 * Database Schema for LearnGlobal.ai
 * Using Drizzle ORM with PostgreSQL
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// Enums
// ==========================================

export const pipelineStateEnum = pgEnum('pipeline_state', [
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
]);

export const artifactTypeEnum = pgEnum('artifact_type', [
  'module_spec',
  'outline',
  'sourcepack_json',
  'sourcepack_markdown',
  'qa_report',
  'media_prompt_pack_json',
  'media_prompt_pack_markdown',
  'heygen_package',
  'asset_manifest',
  'chat_config',
  'other',
]);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'run_created',
  'state_transition',
  'artifact_created',
  'artifact_updated',
  'qa_passed',
  'qa_failed',
  'approval_requested',
  'approval_granted',
  'approval_denied',
  'error_occurred',
  'retry_attempted',
  'run_completed',
  'run_failed',
  'connector_called',
  'llm_called',
]);

export const chatMessageRoleEnum = pgEnum('chat_message_role', [
  'user',
  'assistant',
  'system',
]);

export const learningStyleEnum = pgEnum('learning_style', [
  'visual',
  'text',
  'interactive',
  'audio',
  'mixed',
]);

export const moduleTypeEnum = pgEnum('module_type', [
  'standard',
  'simulation',
  'assessment',
  'interactive',
  'video',
]);

// ==========================================
// User & Learner Tables
// ==========================================

/**
 * Users - Platform users (learners, admins, content creators)
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    vertical: varchar('vertical', { length: 100 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('learner'),
    passwordHash: varchar('password_hash', { length: 255 }),
    avatarUrl: text('avatar_url'),
    preferences: jsonb('preferences').$type<Record<string, unknown>>().default({}),
    lastLoginAt: timestamp('last_login_at'),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    userIdIdx: uniqueIndex('users_user_id_idx').on(table.userId),
    verticalIdx: index('users_vertical_idx').on(table.vertical),
  })
);

/**
 * Learner Profiles - Extended profile for adaptive learning
 * This is the "Brain" that stores learning preferences and goals
 */
export const learnerProfiles = pgTable(
  'learner_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    currentRole: varchar('current_role', { length: 255 }).notNull(),
    learningStyle: learningStyleEnum('learning_style').notNull().default('mixed'),
    primaryGoal: text('primary_goal').notNull(),
    secondaryGoals: jsonb('secondary_goals').$type<string[]>().default([]),
    riskTolerance: integer('risk_tolerance').notNull().default(5), // 1-10 scale
    experienceLevel: varchar('experience_level', { length: 50 }).notNull().default('intermediate'),
    timeAvailability: varchar('time_availability', { length: 50 }).notNull().default('moderate'), // limited, moderate, flexible
    preferredSessionLength: integer('preferred_session_length').notNull().default(30), // minutes
    industryBackground: varchar('industry_background', { length: 255 }),
    certifications: jsonb('certifications').$type<string[]>().default([]),
    strengthAreas: jsonb('strength_areas').$type<string[]>().default([]),
    improvementAreas: jsonb('improvement_areas').$type<string[]>().default([]),
    quizResponses: jsonb('quiz_responses').$type<Record<string, unknown>>().default({}),
    adaptiveSettings: jsonb('adaptive_settings').$type<{
      contentDensity: 'light' | 'moderate' | 'dense';
      exampleFrequency: 'few' | 'moderate' | 'many';
      quizDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
      feedbackStyle: 'brief' | 'detailed' | 'encouraging';
    }>().default({
      contentDensity: 'moderate',
      exampleFrequency: 'moderate',
      quizDifficulty: 'adaptive',
      feedbackStyle: 'detailed',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('learner_profiles_user_idx').on(table.userId),
    roleIdx: index('learner_profiles_role_idx').on(table.currentRole),
    styleIdx: index('learner_profiles_style_idx').on(table.learningStyle),
  })
);

/**
 * Module Progress - Tracks learner progress through modules
 */
export const moduleProgress = pgTable(
  'module_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('not_started'),
    progressPercent: integer('progress_percent').notNull().default(0),
    currentSection: varchar('current_section', { length: 255 }),
    completedSections: jsonb('completed_sections').$type<string[]>().default([]),
    timeSpentMinutes: integer('time_spent_minutes').notNull().default(0),
    lastAccessedAt: timestamp('last_accessed_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    score: integer('score'),
    attempts: integer('attempts').notNull().default(0),
    bookmarks: jsonb('bookmarks').$type<Array<{
      sectionId: string;
      note?: string;
      createdAt: string;
    }>>().default([]),
    notes: jsonb('notes').$type<Array<{
      sectionId: string;
      content: string;
      createdAt: string;
    }>>().default([]),
    adaptiveHistory: jsonb('adaptive_history').$type<Array<{
      timestamp: string;
      action: string;
      context: Record<string, unknown>;
    }>>().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userModuleIdx: uniqueIndex('module_progress_user_module_idx').on(
      table.userId,
      table.moduleId
    ),
    userIdx: index('module_progress_user_idx').on(table.userId),
    moduleIdx: index('module_progress_module_idx').on(table.moduleId),
    statusIdx: index('module_progress_status_idx').on(table.status),
  })
);

/**
 * Simulation Sessions - Tracks simulation (Case 7 style) interactions
 */
export const simulationSessions = pgTable(
  'simulation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: varchar('session_id', { length: 255 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    scenarioId: varchar('scenario_id', { length: 255 }).notNull(),
    scenarioTitle: varchar('scenario_title', { length: 500 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('in_progress'),
    decisions: jsonb('decisions').$type<Array<{
      stepId: string;
      decision: string;
      timestamp: string;
      outcome: string;
      score: number;
      feedback: string;
    }>>().default([]),
    currentStep: varchar('current_step', { length: 255 }),
    totalSteps: integer('total_steps').notNull().default(0),
    completedSteps: integer('completed_steps').notNull().default(0),
    score: integer('score'),
    maxScore: integer('max_score'),
    timeSpentMinutes: integer('time_spent_minutes').notNull().default(0),
    outcomes: jsonb('outcomes').$type<{
      success: boolean;
      summary: string;
      learningPoints: string[];
      areasToImprove: string[];
    }>(),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: uniqueIndex('simulation_sessions_session_id_idx').on(table.sessionId),
    userIdx: index('simulation_sessions_user_idx').on(table.userId),
    moduleIdx: index('simulation_sessions_module_idx').on(table.moduleId),
    scenarioIdx: index('simulation_sessions_scenario_idx').on(table.scenarioId),
  })
);

// ==========================================
// Core Tables
// ==========================================

/**
 * Modules - The main entity representing a training module
 */
export const modules = pgTable(
  'modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: varchar('module_id', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    vertical: varchar('vertical', { length: 100 }).notNull(),
    currentVersion: varchar('current_version', { length: 50 }).notNull().default('1.0.0'),
    author: varchar('author', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    moduleType: moduleTypeEnum('module_type').notNull().default('standard'),
    pillar: varchar('pillar', { length: 100 }), // e.g., "Pillar 1: Safety Fundamentals"
    orderIndex: integer('order_index').notNull().default(0),
    estimatedMinutes: integer('estimated_minutes').notNull().default(30),
    prerequisites: jsonb('prerequisites').$type<string[]>().default([]),
    learningObjectives: jsonb('learning_objectives').$type<string[]>().default([]),
    tags: jsonb('tags').$type<string[]>().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    simulationConfig: jsonb('simulation_config').$type<{
      scenarioId: string;
      title: string;
      description: string;
      steps: Array<{
        id: string;
        prompt: string;
        options: Array<{ id: string; text: string; score: number; feedback: string }>;
      }>;
      passingScore: number;
    }>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    verticalIdx: index('modules_vertical_idx').on(table.vertical),
    statusIdx: index('modules_status_idx').on(table.status),
    moduleIdIdx: uniqueIndex('modules_module_id_idx').on(table.moduleId),
    moduleTypeIdx: index('modules_type_idx').on(table.moduleType),
    pillarIdx: index('modules_pillar_idx').on(table.pillar),
    orderIdx: index('modules_order_idx').on(table.vertical, table.orderIndex),
  })
);

/**
 * Module Specs - Versioned specifications for modules
 */
export const moduleSpecs = pgTable(
  'module_specs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 50 }).notNull(),
    specData: jsonb('spec_data').notNull(),
    specHash: varchar('spec_hash', { length: 64 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    moduleVersionIdx: uniqueIndex('module_specs_module_version_idx').on(
      table.moduleId,
      table.version
    ),
    activeIdx: index('module_specs_active_idx').on(table.moduleId, table.isActive),
  })
);

/**
 * Runs - Pipeline execution instances
 */
export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: varchar('run_id', { length: 255 }).notNull().unique(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    moduleSpecId: uuid('module_spec_id')
      .notNull()
      .references(() => moduleSpecs.id),
    version: varchar('version', { length: 50 }).notNull(),
    currentState: pipelineStateEnum('current_state').notNull().default('DRAFT_MODULE_SPEC'),
    previousState: pipelineStateEnum('previous_state'),
    checkpoint: jsonb('checkpoint').$type<Record<string, unknown>>(),
    error: jsonb('error').$type<{
      code: string;
      message: string;
      recoverable: boolean;
      details?: Record<string, unknown>;
    }>(),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    triggeredBy: varchar('triggered_by', { length: 255 }).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => ({
    moduleIdx: index('runs_module_idx').on(table.moduleId),
    stateIdx: index('runs_state_idx').on(table.currentState),
    runIdIdx: uniqueIndex('runs_run_id_idx').on(table.runId),
  })
);

/**
 * Run States - State transition history
 */
export const runStates = pgTable(
  'run_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    fromState: pipelineStateEnum('from_state'),
    toState: pipelineStateEnum('to_state').notNull(),
    transitionedAt: timestamp('transitioned_at').notNull().defaultNow(),
    actor: varchar('actor', { length: 255 }).notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => ({
    runIdx: index('run_states_run_idx').on(table.runId),
    transitionedAtIdx: index('run_states_transitioned_at_idx').on(table.transitionedAt),
  })
);

/**
 * Artifacts - Generated content artifacts
 */
export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    artifactType: artifactTypeEnum('artifact_type').notNull(),
    version: varchar('version', { length: 50 }).notNull(),
    storageUri: text('storage_uri').notNull(),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    hash: varchar('hash', { length: 64 }).notNull(),
    hashAlgorithm: varchar('hash_algorithm', { length: 20 }).notNull().default('sha256'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index('artifacts_run_idx').on(table.runId),
    typeIdx: index('artifacts_type_idx').on(table.artifactType),
    hashIdx: index('artifacts_hash_idx').on(table.hash),
  })
);

/**
 * Audit Events - Immutable audit log
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: varchar('event_id', { length: 255 }).notNull().unique(),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    moduleId: uuid('module_id').references(() => modules.id, { onDelete: 'set null' }),
    eventType: auditEventTypeEnum('event_type').notNull(),
    actor: varchar('actor', { length: 255 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    fromState: pipelineStateEnum('from_state'),
    toState: pipelineStateEnum('to_state'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    promptHash: varchar('prompt_hash', { length: 64 }),
    responseHash: varchar('response_hash', { length: 64 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
  },
  (table) => ({
    runIdx: index('audit_events_run_idx').on(table.runId),
    moduleIdx: index('audit_events_module_idx').on(table.moduleId),
    eventTypeIdx: index('audit_events_type_idx').on(table.eventType),
    timestampIdx: index('audit_events_timestamp_idx').on(table.timestamp),
    eventIdIdx: uniqueIndex('audit_events_event_id_idx').on(table.eventId),
  })
);

/**
 * Chat Configs - Module-specific chat configurations
 */
export const chatConfigs = pgTable(
  'chat_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    configId: varchar('config_id', { length: 255 }).notNull().unique(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    policyId: varchar('policy_id', { length: 255 }).notNull(),
    retrievalIndexId: varchar('retrieval_index_id', { length: 255 }),
    sources: jsonb('sources').$type<Array<{
      id: string;
      type: string;
      name: string;
      uri: string;
      priority: number;
    }>>().default([]),
    systemPromptTemplate: text('system_prompt_template').notNull(),
    modelConfig: jsonb('model_config').$type<{
      provider: string;
      model: string;
      temperature: number;
      maxTokens: number;
    }>().notNull(),
    features: jsonb('features').$type<Record<string, boolean>>().default({}),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    moduleIdx: index('chat_configs_module_idx').on(table.moduleId),
    configIdIdx: uniqueIndex('chat_configs_config_id_idx').on(table.configId),
    activeIdx: index('chat_configs_active_idx').on(table.moduleId, table.active),
  })
);

/**
 * Chat Messages - Conversation history
 */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: varchar('message_id', { length: 255 }).notNull().unique(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    conversationId: varchar('conversation_id', { length: 255 }).notNull(),
    role: chatMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    retrievedContext: jsonb('retrieved_context').$type<Array<{
      id: string;
      sourceId: string;
      content: string;
      score: number;
    }>>(),
    citations: jsonb('citations').$type<Array<{
      sourceId: string;
      sourceName: string;
      excerpt: string;
    }>>(),
    policyViolations: jsonb('policy_violations').$type<Array<{
      type: string;
      description: string;
      action: string;
    }>>(),
    tokenUsage: jsonb('token_usage').$type<{
      prompt: number;
      completion: number;
      total: number;
    }>(),
    feedback: jsonb('feedback').$type<{
      rating: string;
      comment?: string;
      timestamp: string;
    }>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    sessionId: varchar('session_id', { length: 255 }),
    userId: varchar('user_id', { length: 255 }),
  },
  (table) => ({
    moduleIdx: index('chat_messages_module_idx').on(table.moduleId),
    conversationIdx: index('chat_messages_conversation_idx').on(table.conversationId),
    timestampIdx: index('chat_messages_timestamp_idx').on(table.timestamp),
    messageIdIdx: uniqueIndex('chat_messages_message_id_idx').on(table.messageId),
  })
);

/**
 * Connectors - Configuration metadata for tool connectors
 */
export const connectors = pgTable(
  'connectors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectorId: varchar('connector_id', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    endpoint: text('endpoint'),
    scopes: jsonb('scopes').$type<Array<{
      name: string;
      description: string;
      permissions: string[];
    }>>().default([]),
    capabilities: jsonb('capabilities').$type<Array<{
      name: string;
      description: string;
      requiredScopes: string[];
    }>>().default([]),
    redactionRules: jsonb('redaction_rules').$type<Array<{
      fieldPath: string;
      method: string;
    }>>().default([]),
    retryConfig: jsonb('retry_config').$type<{
      maxRetries: number;
      initialDelayMs: number;
      maxDelayMs: number;
      backoffMultiplier: number;
    }>().default({
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    }),
    timeoutMs: integer('timeout_ms').notNull().default(30000),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('connectors_type_idx').on(table.type),
    connectorIdIdx: uniqueIndex('connectors_connector_id_idx').on(table.connectorId),
  })
);

/**
 * Vertical Configs - Brand/vertical specific configurations
 */
export const verticalConfigs = pgTable(
  'vertical_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vertical: varchar('vertical', { length: 100 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    verticalIdx: uniqueIndex('vertical_configs_vertical_idx').on(table.vertical),
    activeIdx: index('vertical_configs_active_idx').on(table.active),
  })
);

/**
 * Job Queue - For tracking BullMQ jobs
 */
export const jobQueue = pgTable(
  'job_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: varchar('job_id', { length: 255 }).notNull().unique(),
    queueName: varchar('queue_name', { length: 100 }).notNull(),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'cascade' }),
    jobType: varchar('job_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    result: jsonb('result').$type<Record<string, unknown>>(),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    scheduledFor: timestamp('scheduled_for'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    queueNameIdx: index('job_queue_queue_name_idx').on(table.queueName),
    statusIdx: index('job_queue_status_idx').on(table.status),
    runIdx: index('job_queue_run_idx').on(table.runId),
    jobIdIdx: uniqueIndex('job_queue_job_id_idx').on(table.jobId),
  })
);

/**
 * Approvals - For governance workflow
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    approvalType: varchar('approval_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    requestedBy: varchar('requested_by', { length: 255 }).notNull(),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: timestamp('reviewed_at'),
    comments: text('comments'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => ({
    runIdx: index('approvals_run_idx').on(table.runId),
    statusIdx: index('approvals_status_idx').on(table.status),
  })
);

// ==========================================
// Relations
// ==========================================

// User Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  learnerProfile: one(learnerProfiles),
  moduleProgress: many(moduleProgress),
  simulationSessions: many(simulationSessions),
  chatMessages: many(chatMessages),
}));

export const learnerProfilesRelations = relations(learnerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [learnerProfiles.userId],
    references: [users.id],
  }),
}));

export const moduleProgressRelations = relations(moduleProgress, ({ one }) => ({
  user: one(users, {
    fields: [moduleProgress.userId],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [moduleProgress.moduleId],
    references: [modules.id],
  }),
}));

export const simulationSessionsRelations = relations(simulationSessions, ({ one }) => ({
  user: one(users, {
    fields: [simulationSessions.userId],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [simulationSessions.moduleId],
    references: [modules.id],
  }),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
  specs: many(moduleSpecs),
  runs: many(runs),
  chatConfigs: many(chatConfigs),
  chatMessages: many(chatMessages),
  auditEvents: many(auditEvents),
  progress: many(moduleProgress),
  simulationSessions: many(simulationSessions),
}));

export const moduleSpecsRelations = relations(moduleSpecs, ({ one, many }) => ({
  module: one(modules, {
    fields: [moduleSpecs.moduleId],
    references: [modules.id],
  }),
  runs: many(runs),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  module: one(modules, {
    fields: [runs.moduleId],
    references: [modules.id],
  }),
  moduleSpec: one(moduleSpecs, {
    fields: [runs.moduleSpecId],
    references: [moduleSpecs.id],
  }),
  states: many(runStates),
  artifacts: many(artifacts),
  auditEvents: many(auditEvents),
  jobs: many(jobQueue),
  approvals: many(approvals),
  chatConfig: one(chatConfigs),
}));

export const runStatesRelations = relations(runStates, ({ one }) => ({
  run: one(runs, {
    fields: [runStates.runId],
    references: [runs.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  run: one(runs, {
    fields: [artifacts.runId],
    references: [runs.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  run: one(runs, {
    fields: [auditEvents.runId],
    references: [runs.id],
  }),
  module: one(modules, {
    fields: [auditEvents.moduleId],
    references: [modules.id],
  }),
}));

export const chatConfigsRelations = relations(chatConfigs, ({ one }) => ({
  module: one(modules, {
    fields: [chatConfigs.moduleId],
    references: [modules.id],
  }),
  run: one(runs, {
    fields: [chatConfigs.runId],
    references: [runs.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  module: one(modules, {
    fields: [chatMessages.moduleId],
    references: [modules.id],
  }),
}));

export const jobQueueRelations = relations(jobQueue, ({ one }) => ({
  run: one(runs, {
    fields: [jobQueue.runId],
    references: [runs.id],
  }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  run: one(runs, {
    fields: [approvals.runId],
    references: [runs.id],
  }),
}));
