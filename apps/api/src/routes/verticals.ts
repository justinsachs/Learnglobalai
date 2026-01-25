/**
 * Vertical Configuration API Routes
 * Manages brand/vertical configurations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { logger } from '../utils/logger.js';

interface VerticalConfigBody {
  verticalId: string;
  name: string;
  config: {
    branding?: {
      primaryColor?: string;
      secondaryColor?: string;
      logo?: string;
      companyName?: string;
      tagline?: string;
    };
    templates?: {
      outline?: string;
      sourcepack?: string;
      qa?: string;
      mediaPromptPack?: string;
      heygenScript?: string;
    };
    qualityGates?: {
      minTotalWords?: number;
      minWordsPerHeading?: number;
      maxBulletRatio?: number;
      requireDisclaimers?: boolean;
    };
    disclaimers?: string[];
    llmConfig?: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    connectors?: {
      lms?: {
        provider?: string;
        baseUrl?: string;
        accountId?: string;
      };
      storage?: {
        bucket?: string;
        prefix?: string;
      };
      heygen?: {
        avatarId?: string;
        voiceId?: string;
      };
    };
    chatPolicy?: {
      allowedTopics?: string[];
      prohibitedTopics?: string[];
      disclaimers?: string[];
      escalationKeywords?: string[];
    };
  };
}

export async function verticalRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();

  /**
   * List all verticals
   */
  fastify.get('/verticals', async (request: FastifyRequest, reply: FastifyReply) => {
    const verticals = await db.query.verticalConfigs.findMany({
      orderBy: (verticalConfigs, { asc }) => [asc(verticalConfigs.displayName)],
    });

    return reply.send({
      success: true,
      data: verticals,
    });
  });

  /**
   * Get vertical by ID
   */
  fastify.get('/verticals/:verticalId', async (request: FastifyRequest<{ Params: { verticalId: string } }>, reply: FastifyReply) => {
    const { verticalId } = request.params;

    const vertical = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (!vertical) {
      return reply.status(404).send({
        success: false,
        error: 'Vertical not found',
      });
    }

    return reply.send({
      success: true,
      data: vertical,
    });
  });

  /**
   * Create a new vertical
   */
  fastify.post('/verticals', async (request: FastifyRequest<{ Body: VerticalConfigBody }>, reply: FastifyReply) => {
    const { verticalId, name, config } = request.body;

    // Check for existing vertical
    const existing = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: 'Vertical already exists',
      });
    }

    // Apply defaults
    const fullConfig = {
      branding: config.branding || {},
      templates: {
        outline: config.templates?.outline || '',
        sourcepack: config.templates?.sourcepack || '',
        qa: config.templates?.qa || '',
        mediaPromptPack: config.templates?.mediaPromptPack || '',
        heygenScript: config.templates?.heygenScript || '',
      },
      qualityGates: {
        minTotalWords: config.qualityGates?.minTotalWords || 10000,
        minWordsPerHeading: config.qualityGates?.minWordsPerHeading || 500,
        maxBulletRatio: config.qualityGates?.maxBulletRatio || 0.08,
        requireDisclaimers: config.qualityGates?.requireDisclaimers ?? true,
      },
      disclaimers: config.disclaimers || [
        'This training is for educational purposes only.',
        'Always follow your organization\'s specific policies and procedures.',
      ],
      llmConfig: config.llmConfig || {
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 8000,
      },
      connectors: config.connectors || {},
      chatPolicy: config.chatPolicy || {
        allowedTopics: ['training', 'procedures', 'safety', 'compliance'],
        prohibitedTopics: ['legal advice', 'medical diagnosis'],
        disclaimers: ['This is AI-generated guidance, not professional advice.'],
        escalationKeywords: ['emergency', 'urgent', 'lawsuit', 'injury'],
      },
    };

    const [vertical] = await db.insert(schema.verticalConfigs).values({
      vertical: verticalId,
      displayName: name,
      config: fullConfig,
    }).returning();

    logger.info('Vertical created', { vertical: verticalId, name });

    return reply.status(201).send({
      success: true,
      data: vertical,
    });
  });

  /**
   * Update vertical configuration
   */
  fastify.put('/verticals/:verticalId', async (request: FastifyRequest<{ Params: { verticalId: string }; Body: Partial<VerticalConfigBody> }>, reply: FastifyReply) => {
    const { verticalId } = request.params;
    const { name, config } = request.body;

    const existing = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Vertical not found',
      });
    }

    // Merge config
    const mergedConfig = {
      ...existing.config as object,
      ...(config || {}),
    };

    await db.update(schema.verticalConfigs)
      .set({
        displayName: name || existing.displayName,
        config: mergedConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.verticalConfigs.id, existing.id));

    const updated = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.id, existing.id),
    });

    logger.info('Vertical updated', { verticalId });

    return reply.send({
      success: true,
      data: updated,
    });
  });

  /**
   * Delete vertical
   */
  fastify.delete('/verticals/:verticalId', async (request: FastifyRequest<{ Params: { verticalId: string } }>, reply: FastifyReply) => {
    const { verticalId } = request.params;

    const existing = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Vertical not found',
      });
    }

    // Check if vertical is in use
    const modulesUsingVertical = await db.query.modules.findMany({
      where: eq(schema.modules.vertical, verticalId),
      limit: 1,
    });

    if (modulesUsingVertical.length > 0) {
      return reply.status(400).send({
        success: false,
        error: 'Cannot delete vertical that has modules',
      });
    }

    await db.delete(schema.verticalConfigs)
      .where(eq(schema.verticalConfigs.id, existing.id));

    logger.info('Vertical deleted', { verticalId });

    return reply.send({
      success: true,
    });
  });

  /**
   * Clone vertical configuration
   */
  fastify.post('/verticals/:verticalId/clone', async (request: FastifyRequest<{ Params: { verticalId: string }; Body: { newVerticalId: string; newName: string } }>, reply: FastifyReply) => {
    const { verticalId } = request.params;
    const { newVerticalId, newName } = request.body;

    const existing = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Vertical not found',
      });
    }

    // Check if new vertical ID is available
    const newExisting = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, newVerticalId),
    });

    if (newExisting) {
      return reply.status(409).send({
        success: false,
        error: 'New vertical ID already exists',
      });
    }

    const [cloned] = await db.insert(schema.verticalConfigs).values({
      vertical: newVerticalId,
      displayName: newName,
      config: existing.config,
    }).returning();

    logger.info('Vertical cloned', { from: verticalId, to: newVerticalId });

    return reply.status(201).send({
      success: true,
      data: cloned,
    });
  });

  /**
   * Get vertical templates
   */
  fastify.get('/verticals/:verticalId/templates', async (request: FastifyRequest<{ Params: { verticalId: string } }>, reply: FastifyReply) => {
    const { verticalId } = request.params;

    const vertical = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (!vertical) {
      return reply.status(404).send({
        success: false,
        error: 'Vertical not found',
      });
    }

    const config = vertical.config as any;

    return reply.send({
      success: true,
      data: config.templates || {},
    });
  });

  /**
   * Update vertical template
   */
  fastify.put('/verticals/:verticalId/templates/:templateType', async (request: FastifyRequest<{ Params: { verticalId: string; templateType: string }; Body: { content: string } }>, reply: FastifyReply) => {
    const { verticalId, templateType } = request.params;
    const { content } = request.body;

    const validTemplates = ['outline', 'sourcepack', 'qa', 'mediaPromptPack', 'heygenScript'];
    if (!validTemplates.includes(templateType)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid template type. Must be one of: ${validTemplates.join(', ')}`,
      });
    }

    const existing = await db.query.verticalConfigs.findFirst({
      where: eq(schema.verticalConfigs.vertical, verticalId),
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Vertical not found',
      });
    }

    const config = existing.config as any;
    config.templates = config.templates || {};
    config.templates[templateType] = content;

    await db.update(schema.verticalConfigs)
      .set({
        config,
        updatedAt: new Date(),
      })
      .where(eq(schema.verticalConfigs.id, existing.id));

    logger.info('Vertical template updated', { verticalId, templateType });

    return reply.send({
      success: true,
      data: {
        templateType,
        content,
      },
    });
  });
}
