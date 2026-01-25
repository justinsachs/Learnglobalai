/**
 * Approval Workflow API Routes
 * Handles approval requests and grants for LMS publishing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { addPipelineJob } from '../queue/index.js';

interface RequestApprovalBody {
  runId: string;
  type: 'lms_publish' | 'content_release';
  requestedBy: string;
  notes?: string;
}

interface GrantApprovalBody {
  approvedBy: string;
  notes?: string;
  conditions?: string[];
}

interface RejectApprovalBody {
  rejectedBy: string;
  reason: string;
}

export async function approvalRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();

  /**
   * Request approval for a run
   */
  fastify.post('/approvals/request', async (request: FastifyRequest<{ Body: RequestApprovalBody }>, reply: FastifyReply) => {
    const { runId, type, requestedBy, notes } = request.body;

    // Get run
    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.runId, runId),
    });

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: 'Run not found',
      });
    }

    // Check if run is in correct state for approval
    const validStates = {
      'lms_publish': ['LMS_PUBLISHED'],
      'content_release': ['AUDIT_FINALIZED'],
    };

    if (!validStates[type]?.includes(run.currentState)) {
      return reply.status(400).send({
        success: false,
        error: `Run must be in one of these states for ${type} approval: ${validStates[type].join(', ')}`,
        currentState: run.currentState,
      });
    }

    // Check for existing pending approval
    const existing = await db.query.approvals.findFirst({
      where: and(
        eq(schema.approvals.runId, run.id),
        eq(schema.approvals.approvalType, type),
        eq(schema.approvals.status, 'pending')
      ),
    });

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: 'Approval already pending for this run',
        approvalId: existing.approvalId,
      });
    }

    // Create approval request
    const approvalId = `apr-${nanoid(10)}`;
    const [approval] = await db.insert(schema.approvals).values({
      approvalId,
      runId: run.id,
      approvalType: type,
      status: 'pending',
      requestedBy,
      notes,
    }).returning();

    // Log audit event
    await db.insert(schema.auditEvents).values({
      eventId: `evt-${nanoid(10)}`,
      runId: run.id,
      eventType: 'approval_requested',
      actor: requestedBy,
      details: {
        approvalId,
        type,
        notes,
      },
    });

    logger.info('Approval requested', { approvalId, runId, type, requestedBy });

    return reply.status(201).send({
      success: true,
      data: {
        approvalId: approval.approvalId,
        status: approval.status,
        requestedAt: approval.requestedAt,
      },
    });
  });

  /**
   * Grant approval
   */
  fastify.post('/approvals/:approvalId/grant', async (request: FastifyRequest<{ Params: { approvalId: string }; Body: GrantApprovalBody }>, reply: FastifyReply) => {
    const { approvalId } = request.params;
    const { approvedBy, notes, conditions } = request.body;

    const approval = await db.query.approvals.findFirst({
      where: eq(schema.approvals.approvalId, approvalId),
      with: {
        run: true,
      },
    });

    if (!approval) {
      return reply.status(404).send({
        success: false,
        error: 'Approval not found',
      });
    }

    if (approval.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: `Approval is ${approval.status}, cannot grant`,
      });
    }

    // Update approval
    await db.update(schema.approvals)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        notes: notes || approval.notes,
        conditions,
      })
      .where(eq(schema.approvals.id, approval.id));

    // Log audit event
    await db.insert(schema.auditEvents).values({
      eventId: `evt-${nanoid(10)}`,
      runId: approval.runId,
      eventType: 'approval_granted',
      actor: approvedBy,
      details: {
        approvalId,
        conditions,
        notes,
      },
    });

    logger.info('Approval granted', { approvalId, approvedBy });

    // If this is LMS publish approval, trigger the actual publish
    if (approval.approvalType === 'lms_publish' && approval.run) {
      const module = await db.query.modules.findFirst({
        where: eq(schema.modules.id, approval.run.moduleId!),
      });

      if (module) {
        await addPipelineJob({
          type: 'rerun',
          runId: approval.run.runId,
          moduleId: module.moduleId,
          specId: approval.run.moduleSpecId!,
          triggeredBy: approvedBy,
          fromState: 'LMS_PUBLISHED',
        });
      }
    }

    return reply.send({
      success: true,
      data: {
        approvalId,
        status: 'approved',
        approvedBy,
        approvedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Reject approval
   */
  fastify.post('/approvals/:approvalId/reject', async (request: FastifyRequest<{ Params: { approvalId: string }; Body: RejectApprovalBody }>, reply: FastifyReply) => {
    const { approvalId } = request.params;
    const { rejectedBy, reason } = request.body;

    const approval = await db.query.approvals.findFirst({
      where: eq(schema.approvals.approvalId, approvalId),
    });

    if (!approval) {
      return reply.status(404).send({
        success: false,
        error: 'Approval not found',
      });
    }

    if (approval.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: `Approval is ${approval.status}, cannot reject`,
      });
    }

    // Update approval
    await db.update(schema.approvals)
      .set({
        status: 'rejected',
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        notes: reason,
      })
      .where(eq(schema.approvals.id, approval.id));

    // Log audit event
    await db.insert(schema.auditEvents).values({
      eventId: `evt-${nanoid(10)}`,
      runId: approval.runId,
      eventType: 'approval_rejected',
      actor: rejectedBy,
      details: {
        approvalId,
        reason,
      },
    });

    logger.info('Approval rejected', { approvalId, rejectedBy, reason });

    return reply.send({
      success: true,
      data: {
        approvalId,
        status: 'rejected',
        rejectedBy,
        reason,
      },
    });
  });

  /**
   * Get pending approvals
   */
  fastify.get('/approvals/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const approvals = await db.query.approvals.findMany({
      where: eq(schema.approvals.status, 'pending'),
      orderBy: desc(schema.approvals.requestedAt),
      with: {
        run: true,
      },
    });

    return reply.send({
      success: true,
      data: approvals,
    });
  });

  /**
   * Get approval by ID
   */
  fastify.get('/approvals/:approvalId', async (request: FastifyRequest<{ Params: { approvalId: string } }>, reply: FastifyReply) => {
    const { approvalId } = request.params;

    const approval = await db.query.approvals.findFirst({
      where: eq(schema.approvals.approvalId, approvalId),
      with: {
        run: true,
      },
    });

    if (!approval) {
      return reply.status(404).send({
        success: false,
        error: 'Approval not found',
      });
    }

    return reply.send({
      success: true,
      data: approval,
    });
  });

  /**
   * Get approvals for a run
   */
  fastify.get('/runs/:runId/approvals', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.runId, runId),
    });

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: 'Run not found',
      });
    }

    const approvals = await db.query.approvals.findMany({
      where: eq(schema.approvals.runId, run.id),
      orderBy: desc(schema.approvals.requestedAt),
    });

    return reply.send({
      success: true,
      data: approvals,
    });
  });
}
