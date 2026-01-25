/**
 * Learner Routes
 * Handles user onboarding, profiling, and adaptive learning features
 */

import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';

// ==========================================
// Validation Schemas
// ==========================================

const onboardingQuizSchema = z.object({
  currentRole: z.string().min(1),
  learningStyle: z.enum(['visual', 'text', 'interactive', 'audio', 'mixed']),
  primaryGoal: z.string().min(10),
  secondaryGoals: z.array(z.string()).optional().default([]),
  riskTolerance: z.number().min(1).max(10).optional().default(5),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  timeAvailability: z.enum(['limited', 'moderate', 'flexible']).optional().default('moderate'),
  preferredSessionLength: z.number().min(5).max(120).optional().default(30),
  industryBackground: z.string().optional(),
});

const updateProfileSchema = z.object({
  currentRole: z.string().min(1).optional(),
  learningStyle: z.enum(['visual', 'text', 'interactive', 'audio', 'mixed']).optional(),
  primaryGoal: z.string().min(10).optional(),
  secondaryGoals: z.array(z.string()).optional(),
  riskTolerance: z.number().min(1).max(10).optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  timeAvailability: z.enum(['limited', 'moderate', 'flexible']).optional(),
  preferredSessionLength: z.number().min(5).max(120).optional(),
  adaptiveSettings: z.object({
    contentDensity: z.enum(['light', 'moderate', 'dense']).optional(),
    exampleFrequency: z.enum(['few', 'moderate', 'many']).optional(),
    quizDifficulty: z.enum(['easy', 'medium', 'hard', 'adaptive']).optional(),
    feedbackStyle: z.enum(['brief', 'detailed', 'encouraging']).optional(),
  }).optional(),
});

const progressUpdateSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed', 'paused']).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  currentSection: z.string().optional(),
  completedSections: z.array(z.string()).optional(),
  timeSpentMinutes: z.number().optional(),
  score: z.number().optional(),
});

const simulationDecisionSchema = z.object({
  stepId: z.string(),
  decision: z.string(),
});

// ==========================================
// Routes
// ==========================================

export const learnerRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDatabase();

  // ==========================================
  // Onboarding & Profile Routes
  // ==========================================

  /**
   * Complete onboarding quiz and create learner profile
   * This is the "Gatekeeper" - must be completed before accessing content
   */
  fastify.post<{
    Body: z.infer<typeof onboardingQuizSchema>;
  }>('/onboarding/complete', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const parsed = onboardingQuizSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid quiz data',
        details: parsed.error.issues,
      });
    }

    const data = parsed.data;

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    // Check if profile already exists
    const existingProfile = await db.query.learnerProfiles.findFirst({
      where: eq(schema.learnerProfiles.userId, user.id),
    });

    if (existingProfile) {
      // Update existing profile
      await db.update(schema.learnerProfiles)
        .set({
          currentRole: data.currentRole,
          learningStyle: data.learningStyle,
          primaryGoal: data.primaryGoal,
          secondaryGoals: data.secondaryGoals,
          riskTolerance: data.riskTolerance,
          experienceLevel: data.experienceLevel,
          timeAvailability: data.timeAvailability,
          preferredSessionLength: data.preferredSessionLength,
          industryBackground: data.industryBackground,
          quizResponses: data as any,
          updatedAt: new Date(),
        })
        .where(eq(schema.learnerProfiles.id, existingProfile.id));
    } else {
      // Create new profile
      await db.insert(schema.learnerProfiles).values({
        userId: user.id,
        currentRole: data.currentRole,
        learningStyle: data.learningStyle,
        primaryGoal: data.primaryGoal,
        secondaryGoals: data.secondaryGoals,
        riskTolerance: data.riskTolerance,
        experienceLevel: data.experienceLevel,
        timeAvailability: data.timeAvailability,
        preferredSessionLength: data.preferredSessionLength,
        industryBackground: data.industryBackground,
        quizResponses: data as any,
      });
    }

    // Mark user as onboarding complete
    await db.update(schema.users)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    return {
      success: true,
      message: 'Onboarding completed successfully',
      redirect: '/dashboard',
    };
  });

  /**
   * Get learner profile with adaptive context
   * This provides the "brain" data for AI personalization
   */
  fastify.get('/profile', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
      with: {
        learnerProfile: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    if (!user.learnerProfile) {
      return reply.status(404).send({
        success: false,
        error: 'Profile not found',
        requiresOnboarding: true,
        redirect: '/onboarding',
      });
    }

    return {
      success: true,
      data: {
        user: {
          id: user.userId,
          email: user.email,
          displayName: user.displayName,
          vertical: user.vertical,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted,
        },
        profile: user.learnerProfile,
        // Generate adaptive context for AI
        adaptiveContext: generateAdaptiveContext(user.learnerProfile),
      },
    };
  });

  /**
   * Update learner profile
   */
  fastify.patch<{
    Body: z.infer<typeof updateProfileSchema>;
  }>('/profile', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid profile data',
        details: parsed.error.issues,
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
      with: { learnerProfile: true },
    });

    if (!user?.learnerProfile) {
      return reply.status(404).send({ success: false, error: 'Profile not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const data = parsed.data;

    if (data.currentRole) updates.currentRole = data.currentRole;
    if (data.learningStyle) updates.learningStyle = data.learningStyle;
    if (data.primaryGoal) updates.primaryGoal = data.primaryGoal;
    if (data.secondaryGoals) updates.secondaryGoals = data.secondaryGoals;
    if (data.riskTolerance) updates.riskTolerance = data.riskTolerance;
    if (data.experienceLevel) updates.experienceLevel = data.experienceLevel;
    if (data.timeAvailability) updates.timeAvailability = data.timeAvailability;
    if (data.preferredSessionLength) updates.preferredSessionLength = data.preferredSessionLength;
    if (data.adaptiveSettings) {
      updates.adaptiveSettings = {
        ...user.learnerProfile.adaptiveSettings as any,
        ...data.adaptiveSettings,
      };
    }

    await db.update(schema.learnerProfiles)
      .set(updates as any)
      .where(eq(schema.learnerProfiles.id, user.learnerProfile.id));

    return { success: true, message: 'Profile updated' };
  });

  // ==========================================
  // Progress Routes
  // ==========================================

  /**
   * Get all module progress for a user
   */
  fastify.get('/progress', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    const progress = await db.query.moduleProgress.findMany({
      where: eq(schema.moduleProgress.userId, user.id),
      with: {
        module: true,
      },
      orderBy: (mp, { desc }) => [desc(mp.lastAccessedAt)],
    });

    return {
      success: true,
      data: progress.map(p => ({
        moduleId: p.module?.moduleId,
        moduleTitle: p.module?.title,
        moduleType: p.module?.moduleType,
        pillar: p.module?.pillar,
        status: p.status,
        progressPercent: p.progressPercent,
        timeSpentMinutes: p.timeSpentMinutes,
        score: p.score,
        lastAccessedAt: p.lastAccessedAt,
        completedAt: p.completedAt,
      })),
    };
  });

  /**
   * Get or create progress for a specific module
   */
  fastify.get<{
    Params: { moduleId: string };
  }>('/progress/:moduleId', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const { moduleId } = request.params;

    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({ success: false, error: 'Module not found' });
    }

    let progress = await db.query.moduleProgress.findFirst({
      where: and(
        eq(schema.moduleProgress.userId, user.id),
        eq(schema.moduleProgress.moduleId, module.id)
      ),
    });

    // Create progress record if it doesn't exist
    if (!progress) {
      const [newProgress] = await db.insert(schema.moduleProgress)
        .values({
          userId: user.id,
          moduleId: module.id,
          status: 'not_started',
        })
        .returning();
      progress = newProgress;
    }

    return {
      success: true,
      data: progress,
    };
  });

  /**
   * Update progress for a module
   */
  fastify.patch<{
    Params: { moduleId: string };
    Body: z.infer<typeof progressUpdateSchema>;
  }>('/progress/:moduleId', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const { moduleId } = request.params;

    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const parsed = progressUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid progress data',
        details: parsed.error.issues,
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module) {
      return reply.status(404).send({ success: false, error: 'Module not found' });
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = {
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
    };

    if (data.status) {
      updates.status = data.status;
      if (data.status === 'in_progress' && !updates.startedAt) {
        updates.startedAt = new Date();
      }
      if (data.status === 'completed') {
        updates.completedAt = new Date();
      }
    }
    if (data.progressPercent !== undefined) updates.progressPercent = data.progressPercent;
    if (data.currentSection) updates.currentSection = data.currentSection;
    if (data.completedSections) updates.completedSections = data.completedSections;
    if (data.timeSpentMinutes !== undefined) updates.timeSpentMinutes = data.timeSpentMinutes;
    if (data.score !== undefined) updates.score = data.score;

    await db.update(schema.moduleProgress)
      .set(updates as any)
      .where(and(
        eq(schema.moduleProgress.userId, user.id),
        eq(schema.moduleProgress.moduleId, module.id)
      ));

    return { success: true, message: 'Progress updated' };
  });

  // ==========================================
  // Simulation Routes (Case 7 style)
  // ==========================================

  /**
   * Start a new simulation session
   */
  fastify.post<{
    Params: { moduleId: string };
  }>('/simulations/:moduleId/start', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const { moduleId } = request.params;

    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, userId),
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    const module = await db.query.modules.findFirst({
      where: eq(schema.modules.moduleId, moduleId),
    });

    if (!module || module.moduleType !== 'simulation') {
      return reply.status(404).send({ success: false, error: 'Simulation module not found' });
    }

    const simulationConfig = module.simulationConfig as any;
    if (!simulationConfig) {
      return reply.status(400).send({ success: false, error: 'Simulation not configured' });
    }

    const sessionId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const [session] = await db.insert(schema.simulationSessions)
      .values({
        sessionId,
        userId: user.id,
        moduleId: module.id,
        scenarioId: simulationConfig.scenarioId,
        scenarioTitle: simulationConfig.title,
        status: 'in_progress',
        currentStep: simulationConfig.steps[0]?.id,
        totalSteps: simulationConfig.steps.length,
      })
      .returning();

    return {
      success: true,
      data: {
        sessionId: session.sessionId,
        scenario: {
          id: simulationConfig.scenarioId,
          title: simulationConfig.title,
          description: simulationConfig.description,
        },
        currentStep: simulationConfig.steps[0],
        totalSteps: simulationConfig.steps.length,
      },
    };
  });

  /**
   * Submit a decision in a simulation
   */
  fastify.post<{
    Params: { sessionId: string };
    Body: z.infer<typeof simulationDecisionSchema>;
  }>('/simulations/sessions/:sessionId/decide', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const { sessionId } = request.params;

    if (!userId) {
      return reply.status(401).send({ success: false, error: 'User ID required' });
    }

    const parsed = simulationDecisionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid decision data',
        details: parsed.error.issues,
      });
    }

    const session = await db.query.simulationSessions.findFirst({
      where: eq(schema.simulationSessions.sessionId, sessionId),
      with: { module: true },
    });

    if (!session) {
      return reply.status(404).send({ success: false, error: 'Session not found' });
    }

    const simulationConfig = session.module?.simulationConfig as any;
    if (!simulationConfig) {
      return reply.status(400).send({ success: false, error: 'Simulation not configured' });
    }

    const { stepId, decision } = parsed.data;
    const currentStepConfig = simulationConfig.steps.find((s: any) => s.id === stepId);
    if (!currentStepConfig) {
      return reply.status(400).send({ success: false, error: 'Invalid step' });
    }

    const selectedOption = currentStepConfig.options.find((o: any) => o.id === decision);
    if (!selectedOption) {
      return reply.status(400).send({ success: false, error: 'Invalid decision' });
    }

    // Record the decision
    const decisions = [...(session.decisions as any[] || []), {
      stepId,
      decision,
      timestamp: new Date().toISOString(),
      outcome: selectedOption.feedback,
      score: selectedOption.score,
      feedback: selectedOption.feedback,
    }];

    // Find next step
    const currentStepIndex = simulationConfig.steps.findIndex((s: any) => s.id === stepId);
    const nextStep = simulationConfig.steps[currentStepIndex + 1];
    const isComplete = !nextStep;

    // Calculate total score
    const totalScore = decisions.reduce((sum: number, d: any) => sum + d.score, 0);
    const maxScore = simulationConfig.steps.reduce((sum: number, s: any) => {
      const maxOptionScore = Math.max(...s.options.map((o: any) => o.score));
      return sum + maxOptionScore;
    }, 0);

    // Update session
    const updates: Record<string, unknown> = {
      decisions,
      completedSteps: decisions.length,
      score: totalScore,
      maxScore,
    };

    if (isComplete) {
      updates.status = 'completed';
      updates.completedAt = new Date();
      updates.outcomes = {
        success: totalScore >= simulationConfig.passingScore,
        summary: totalScore >= simulationConfig.passingScore
          ? 'Congratulations! You successfully completed the simulation.'
          : 'You completed the simulation. Review the feedback to improve.',
        learningPoints: decisions.filter((d: any) => d.score > 0).map((d: any) => d.feedback),
        areasToImprove: decisions.filter((d: any) => d.score === 0).map((d: any) => d.feedback),
      };
    } else {
      updates.currentStep = nextStep.id;
    }

    await db.update(schema.simulationSessions)
      .set(updates as any)
      .where(eq(schema.simulationSessions.id, session.id));

    return {
      success: true,
      data: {
        decision: {
          stepId,
          decision,
          score: selectedOption.score,
          feedback: selectedOption.feedback,
        },
        nextStep: isComplete ? null : nextStep,
        isComplete,
        progress: {
          completedSteps: decisions.length,
          totalSteps: simulationConfig.steps.length,
          currentScore: totalScore,
          maxScore,
        },
        outcomes: isComplete ? updates.outcomes : null,
      },
    };
  });

  /**
   * Get simulation session status
   */
  fastify.get<{
    Params: { sessionId: string };
  }>('/simulations/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;

    const session = await db.query.simulationSessions.findFirst({
      where: eq(schema.simulationSessions.sessionId, sessionId),
      with: { module: true },
    });

    if (!session) {
      return reply.status(404).send({ success: false, error: 'Session not found' });
    }

    return {
      success: true,
      data: session,
    };
  });
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Generate adaptive context for AI personalization
 * This is injected into the AI system prompt
 */
function generateAdaptiveContext(profile: any): string {
  const parts: string[] = [];

  // Role-based context
  parts.push(`The learner is a ${profile.currentRole}.`);

  // Learning style
  const styleGuides: Record<string, string> = {
    visual: 'Use diagrams, charts, and visual examples when explaining concepts.',
    text: 'Provide detailed written explanations with clear structure.',
    interactive: 'Suggest hands-on activities and interactive exercises.',
    audio: 'Structure content as if explaining verbally, with clear narrative flow.',
    mixed: 'Balance visual, textual, and interactive elements.',
  };
  parts.push(styleGuides[profile.learningStyle] || styleGuides.mixed);

  // Goal context
  parts.push(`Their primary learning goal is: "${profile.primaryGoal}".`);

  // Experience level
  const levelGuides: Record<string, string> = {
    beginner: 'Explain fundamental concepts and avoid jargon. Provide more context.',
    intermediate: 'Assume basic knowledge. Focus on practical applications.',
    advanced: 'Use technical terminology freely. Focus on nuances and edge cases.',
  };
  parts.push(levelGuides[profile.experienceLevel] || levelGuides.intermediate);

  // Risk tolerance
  if (profile.riskTolerance <= 3) {
    parts.push('The learner prefers cautious, conservative approaches. Emphasize safety and verification.');
  } else if (profile.riskTolerance >= 7) {
    parts.push('The learner is comfortable with calculated risks. Include innovative approaches.');
  }

  // Session length
  if (profile.preferredSessionLength <= 15) {
    parts.push('Keep responses concise and focused. The learner prefers short sessions.');
  } else if (profile.preferredSessionLength >= 45) {
    parts.push('Feel free to provide comprehensive, detailed responses.');
  }

  // Adaptive settings
  const settings = profile.adaptiveSettings || {};
  if (settings.feedbackStyle === 'encouraging') {
    parts.push('Use encouraging, supportive language when providing feedback.');
  } else if (settings.feedbackStyle === 'brief') {
    parts.push('Keep feedback concise and actionable.');
  }

  return parts.join(' ');
}

export default learnerRoutes;
