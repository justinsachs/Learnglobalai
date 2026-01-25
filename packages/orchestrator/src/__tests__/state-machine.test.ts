/**
 * State Machine Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineState } from '@learnglobal/contracts';
import { PipelineStateMachine, createOrchestrator, createRunContext } from '../index.js';
import type { OrchestratorDependencies, RunContext, StateHandlerResult } from '../types.js';

// Mock dependencies
const createMockDependencies = (): OrchestratorDependencies => ({
  saveRunState: vi.fn().mockResolvedValue(undefined),
  loadRunState: vi.fn().mockResolvedValue(null),
  saveArtifact: vi.fn().mockResolvedValue('artifact-123'),
  loadArtifact: vi.fn().mockResolvedValue({}),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditEntries: vi.fn().mockResolvedValue([]),
  getVerticalConfig: vi.fn().mockResolvedValue({
    vertical: 'test',
    templates: {
      outline: '',
      sourcepack: '',
      qa: '',
      mediaPromptPack: '',
      heygenScript: '',
    },
    qualityGates: {
      minTotalWords: 1000,
      minWordsPerHeading: 100,
      maxBulletRatio: 0.08,
      requireDisclaimers: true,
    },
    disclaimers: ['Test disclaimer'],
    mediaConfig: { videoMinutes: 5 },
    chatPolicy: {
      allowedTopics: ['test'],
      prohibitedTopics: [],
      disclaimers: [],
    },
  }),
  contentRepo: {
    putObject: vi.fn().mockResolvedValue({ uri: 's3://test/path', etag: 'etag123' }),
    getObject: vi.fn().mockResolvedValue({ body: Buffer.from('{}'), contentType: 'application/json' }),
    listObjects: vi.fn().mockResolvedValue([]),
    deleteObject: vi.fn().mockResolvedValue(undefined),
  },
  llmProvider: {
    generateOutline: vi.fn().mockResolvedValue({
      outline: {
        moduleId: 'test-mod',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        headings: [],
        objectiveMapping: [],
        standardsMapping: [],
        estimatedWordCount: 5000,
      },
      usage: { prompt: 100, completion: 200, total: 300 },
    }),
    generateSourcePack: vi.fn().mockResolvedValue({
      sourcePack: {
        moduleId: 'test-mod',
        version: '1.0.0',
        runId: 'run-123',
        title: 'Test Module',
        generatedAt: new Date().toISOString(),
        sections: [],
        glossary: [],
        references: [],
        disclaimers: ['Test disclaimer'],
        totalWordCount: 5000,
      },
      usage: { prompt: 500, completion: 2000, total: 2500 },
    }),
    generateQAReport: vi.fn().mockResolvedValue({
      qaReport: { passed: true },
      usage: { prompt: 0, completion: 0, total: 0 },
    }),
    generateMediaPromptPack: vi.fn().mockResolvedValue({
      mediaPromptPack: {},
      usage: { prompt: 100, completion: 200, total: 300 },
    }),
    generateHeyGenPackage: vi.fn().mockResolvedValue({
      heygenPackage: {},
      usage: { prompt: 100, completion: 200, total: 300 },
    }),
  },
  notebookLm: {
    createNotebook: vi.fn().mockResolvedValue({ notebookId: 'nb-123' }),
    uploadSource: vi.fn().mockResolvedValue({ sourceId: 'src-123' }),
    shareNotebook: vi.fn().mockResolvedValue({ shareUrl: 'https://notebooklm.google.com/share/123' }),
  },
  heygen: {
    createVideo: vi.fn().mockResolvedValue({ jobId: 'job-123' }),
    pollStatus: vi.fn().mockResolvedValue({ status: 'completed', videoUrl: 'https://heygen.com/video/123' }),
  },
  lms: {
    createModule: vi.fn().mockResolvedValue({ modulePageId: 'page-123', moduleUrl: '/modules/page-123' }),
    uploadAsset: vi.fn().mockResolvedValue({ assetId: 'asset-123' }),
    attachAsset: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue({ moduleUrl: '/modules/page-123' }),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
});

const createTestModuleSpec = () => ({
  moduleId: 'test-mod-001',
  title: 'Test Training Module',
  vertical: 'medviro',
  version: '1.0.0',
  author: 'test@example.com',
  targetAudienceRoles: ['tech', 'supervisor'],
  learningObjectives: [
    'Understand test concepts',
    'Apply test procedures',
  ],
  standardsMap: [
    {
      standardName: 'TEST-001',
      sectionRef: '1.1',
      requirementSummary: 'Test requirement',
    },
  ],
  scenarios: [],
  requiredArtifacts: [
    {
      id: 'checklist-1',
      type: 'checklist' as const,
      title: 'Test Checklist',
      description: 'A test checklist',
      passCriteria: ['Has items'],
    },
  ],
  constraints: {
    minWordsPerMajorHeading: 500,
    minTotalWords: 3000,
    maxBulletRatio: 0.08,
    forbiddenFormattingRules: ['No all caps'],
    requiredDisclaimers: ['This is a test'],
  },
  safetyBoundaries: {
    scopeOfAdvice: 'Test scope',
    disclaimers: ['Test disclaimer'],
    escalationTriggers: ['emergency'],
    prohibitedTopics: [],
  },
  mediaPreferences: {
    videoMinutesTarget: 10,
    avatarStyle: 'professional',
    audioTone: 'formal',
    infographicStyle: 'minimal',
  },
  tags: ['test'],
});

describe('PipelineStateMachine', () => {
  let deps: OrchestratorDependencies;

  beforeEach(() => {
    deps = createMockDependencies();
    vi.clearAllMocks();
  });

  describe('createRunContext', () => {
    it('should create a valid run context from module spec', () => {
      const spec = createTestModuleSpec();
      const context = createRunContext(spec, 'test-user', {});

      expect(context.runId).toBeDefined();
      expect(context.runId).toMatch(/^run-/);
      expect(context.moduleId).toBe(spec.moduleId);
      expect(context.version).toBe(spec.version);
      expect(context.currentState).toBe(PipelineState.DRAFT_MODULE_SPEC);
      expect(context.triggeredBy).toBe('test-user');
      expect(context.moduleSpec).toEqual(spec);
    });

    it('should apply run config options', () => {
      const spec = createTestModuleSpec();
      const config = {
        skipNotebookLm: true,
        skipHeygen: true,
        autoApprove: true,
      };

      const context = createRunContext(spec, 'test-user', config);

      expect(context.config.skipNotebookLm).toBe(true);
      expect(context.config.skipHeygen).toBe(true);
      expect(context.config.autoApprove).toBe(true);
    });
  });

  describe('createOrchestrator', () => {
    it('should create an orchestrator with all state handlers registered', () => {
      const orchestrator = createOrchestrator(deps);

      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.run).toBe('function');
      expect(typeof orchestrator.resume).toBe('function');
      expect(typeof orchestrator.rerunFromState).toBe('function');
    });
  });

  describe('State Transitions', () => {
    it('should transition from DRAFT_MODULE_SPEC to OUTLINE_GENERATED', async () => {
      const orchestrator = createOrchestrator(deps);
      const spec = createTestModuleSpec();
      const context = createRunContext(spec, 'test-user', {
        skipNotebookLm: true,
        skipHeygen: true,
        skipLmsPublish: true,
        skipChat: true,
      });

      // Execute just the first state
      const result = await orchestrator.executeState(context);

      expect(result.success).toBe(true);
      expect(result.nextState).toBe(PipelineState.OUTLINE_GENERATED);
    });

    it('should save run state after each transition', async () => {
      const orchestrator = createOrchestrator(deps);
      const spec = createTestModuleSpec();
      const context = createRunContext(spec, 'test-user', {
        skipNotebookLm: true,
        skipHeygen: true,
        skipLmsPublish: true,
        skipChat: true,
      });

      await orchestrator.executeState(context);

      expect(deps.saveRunState).toHaveBeenCalled();
    });

    it('should log audit events for state transitions', async () => {
      const orchestrator = createOrchestrator(deps);
      const spec = createTestModuleSpec();
      const context = createRunContext(spec, 'test-user', {});

      await orchestrator.executeState(context);

      expect(deps.logAuditEvent).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM provider errors gracefully', async () => {
      const errorDeps = createMockDependencies();
      errorDeps.llmProvider.generateOutline = vi.fn().mockRejectedValue(new Error('LLM API error'));

      const orchestrator = createOrchestrator(errorDeps);
      const spec = createTestModuleSpec();
      const context = createRunContext(spec, 'test-user', {});

      // Move to OUTLINE_GENERATED state to trigger LLM call
      context.currentState = PipelineState.OUTLINE_GENERATED;

      const result = await orchestrator.executeState(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('LLM API error');
    });

    it('should mark errors as recoverable when appropriate', async () => {
      const errorDeps = createMockDependencies();
      errorDeps.llmProvider.generateOutline = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

      const orchestrator = createOrchestrator(errorDeps);
      const spec = createTestModuleSpec();
      const context = createRunContext(spec, 'test-user', {});
      context.currentState = PipelineState.OUTLINE_GENERATED;

      const result = await orchestrator.executeState(context);

      expect(result.success).toBe(false);
      expect(result.error?.recoverable).toBe(true);
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('Resume and Rerun', () => {
    it('should resume a failed run from the last checkpoint', async () => {
      const resumeDeps = createMockDependencies();
      const savedContext: RunContext = {
        runId: 'run-123',
        moduleId: 'mod-123',
        version: '1.0.0',
        currentState: PipelineState.FAILED,
        previousState: PipelineState.SOURCEPACK_GENERATED,
        startedAt: new Date().toISOString(),
        triggeredBy: 'test-user',
        config: {},
        moduleSpec: createTestModuleSpec(),
        outline: { moduleId: 'mod-123', version: '1.0.0', generatedAt: '', headings: [], objectiveMapping: [], standardsMapping: [], estimatedWordCount: 5000 },
        metadata: {},
      };

      resumeDeps.loadRunState = vi.fn().mockResolvedValue(savedContext);

      const orchestrator = createOrchestrator(resumeDeps);
      const result = await orchestrator.resume('run-123');

      expect(resumeDeps.loadRunState).toHaveBeenCalledWith('run-123');
      expect(result).toBeDefined();
    });

    it('should throw error when resuming non-existent run', async () => {
      const orchestrator = createOrchestrator(deps);

      await expect(orchestrator.resume('non-existent-run')).rejects.toThrow();
    });
  });
});

describe('Quality Gates', () => {
  let deps: OrchestratorDependencies;

  beforeEach(() => {
    deps = createMockDependencies();
  });

  it('should fail QA when word count is too low', async () => {
    const lowWordCountSourcePack = {
      moduleId: 'test-mod',
      version: '1.0.0',
      runId: 'run-123',
      title: 'Test',
      generatedAt: new Date().toISOString(),
      sections: [
        {
          id: 'sec-1',
          heading: 'Test Section',
          fullProseText: 'Too short.',
          wordCount: 10,
          traceability: [],
        },
      ],
      glossary: [],
      references: [],
      disclaimers: [],
      totalWordCount: 10,
    };

    deps.llmProvider.generateSourcePack = vi.fn().mockResolvedValue({
      sourcePack: lowWordCountSourcePack,
      usage: { prompt: 100, completion: 100, total: 200 },
    });

    const orchestrator = createOrchestrator(deps);
    const spec = createTestModuleSpec();
    const context = createRunContext(spec, 'test-user', {});
    context.currentState = PipelineState.QA_PASSED;
    context.sourcePack = lowWordCountSourcePack as any;

    const result = await orchestrator.executeState(context);

    expect(result.success).toBe(false);
    expect(result.nextState).toBe(PipelineState.FAILED);
  });
});
