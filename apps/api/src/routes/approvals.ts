import type { FastifyPluginAsync } from 'fastify';
import { ApprovalStatus, AuditAction, AuditSeverity, RiskLevel } from '@jak-shield/shared';
import { getApprovalQueue } from '@jak-shield/approval-gateway';
import { getAuditLogger } from '@jak-shield/audit-log';
import { broadcastApprovalEvent } from './sse.js';

export const approvalsRoutes: FastifyPluginAsync = async (app) => {
  const queue = getApprovalQueue();
  const audit = getAuditLogger();

  app.get('/', async (req) => {
    const q = req.query as { tenantId?: string; status?: string; limit?: string };
    const tenantId = q.tenantId ?? process.env.SHIELD_DEFAULT_TENANT_ID ?? 'local';
    const status = q.status ? (q.status.toUpperCase() as ApprovalStatus) : undefined;
    const limit = q.limit ? Number(q.limit) : 50;
    return queue.list(tenantId, status, limit);
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const rec = await queue.get(id);
    if (!rec) return reply.code(404).send({ error: 'not_found' });
    return rec;
  });

  app.post('/', async (req) => {
    const body = req.body as {
      tenantId: string;
      userId?: string;
      toolName: string;
      argsRedacted: Record<string, unknown>;
      reason: string;
      rule?: string;
      risk: RiskLevel;
    };
    const created = await queue.create(body);
    await audit.log({
      tenantId: body.tenantId,
      action: AuditAction.APPROVAL_REQUESTED,
      severity: AuditSeverity.WARN,
      resource: body.toolName,
      details: { approvalId: created.id, source: 'api' },
    });
    broadcastApprovalEvent({ type: 'created', approval: created });
    return created;
  });

  app.post('/:id/decide', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status: 'APPROVED' | 'REJECTED' | 'DEFERRED'; decidedBy: string; note?: string };
    if (!['APPROVED', 'REJECTED', 'DEFERRED'].includes(body.status)) {
      return reply.code(400).send({ error: 'invalid_status' });
    }
    const updated = await queue.decide({
      id,
      decidedBy: body.decidedBy,
      status: body.status as ApprovalStatus.APPROVED | ApprovalStatus.REJECTED | ApprovalStatus.DEFERRED,
      note: body.note,
    });
    await audit.log({
      tenantId: updated.tenantId,
      action: body.status === 'APPROVED' ? AuditAction.APPROVAL_GRANTED : AuditAction.APPROVAL_REJECTED,
      severity: AuditSeverity.WARN,
      resource: updated.toolName,
      details: { approvalId: id, decidedBy: body.decidedBy, note: body.note },
    });
    broadcastApprovalEvent({ type: 'decided', approval: updated });
    return updated;
  });

  app.post('/expire-stale', async () => {
    const n = await queue.expireStale();
    return { expired: n };
  });
};
