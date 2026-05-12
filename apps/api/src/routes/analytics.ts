import type { FastifyPluginAsync } from 'fastify';
import { getPrisma } from '@jak-shield/approval-gateway';
import { resolveAuth } from '../middleware/auth.js';

const RANGES: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/summary', { preHandler: resolveAuth }, async (req) => {
    const tenantId = req.auth!.tenantId;
    const range = (req.query as { range?: string }).range ?? '7d';
    const since = new Date(Date.now() - (RANGES[range] ?? RANGES['7d']!));
    const prisma = getPrisma();

    const [totalDecisions, blocked, approvalsCreated, approvalsApproved, redactions, injections, classifierCalls] = await Promise.all([
      prisma.auditLogEntry.count({ where: { tenantId, action: 'POLICY_DECISION', timestamp: { gte: since } } }),
      prisma.auditLogEntry.count({ where: { tenantId, action: 'TOOL_CALL_BLOCKED', timestamp: { gte: since } } }),
      prisma.auditLogEntry.count({ where: { tenantId, action: 'APPROVAL_REQUESTED', timestamp: { gte: since } } }),
      prisma.auditLogEntry.count({ where: { tenantId, action: 'APPROVAL_GRANTED', timestamp: { gte: since } } }),
      prisma.auditLogEntry.count({ where: { tenantId, action: 'PII_REDACTED', timestamp: { gte: since } } }),
      prisma.auditLogEntry.count({ where: { tenantId, action: 'INJECTION_DETECTED', timestamp: { gte: since } } }),
      prisma.auditLogEntry.count({ where: { tenantId, action: 'CLASSIFIER_INVOKED', timestamp: { gte: since } } }),
    ]);

    const blockRate = totalDecisions > 0 ? blocked / totalDecisions : 0;
    const approvalRate = approvalsCreated > 0 ? approvalsApproved / approvalsCreated : 0;

    return {
      range,
      since: since.toISOString(),
      totals: {
        decisions: totalDecisions,
        blocked,
        approvalsCreated,
        approvalsApproved,
        redactions,
        injections,
        classifierCalls,
      },
      ratios: {
        blockRate,
        approvalRate,
      },
    };
  });

  app.get('/timeline', { preHandler: resolveAuth }, async (req) => {
    const tenantId = req.auth!.tenantId;
    const range = (req.query as { range?: string }).range ?? '7d';
    const ms = RANGES[range] ?? RANGES['7d']!;
    const since = new Date(Date.now() - ms);
    const buckets = 24;
    const bucketMs = Math.max(60_000, Math.floor(ms / buckets));

    const prisma = getPrisma();
    const rows = await prisma.auditLogEntry.findMany({
      where: { tenantId, timestamp: { gte: since } },
      select: { action: true, timestamp: true },
    });

    const series = Array.from({ length: buckets }, (_, i) => ({
      bucket: new Date(since.getTime() + i * bucketMs).toISOString(),
      decisions: 0,
      blocked: 0,
      approvals: 0,
      redactions: 0,
    }));

    for (const r of rows) {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor((r.timestamp.getTime() - since.getTime()) / bucketMs)));
      const slot = series[idx]!;
      if (r.action === 'POLICY_DECISION') slot.decisions++;
      else if (r.action === 'TOOL_CALL_BLOCKED') slot.blocked++;
      else if (r.action === 'APPROVAL_REQUESTED') slot.approvals++;
      else if (r.action === 'PII_REDACTED') slot.redactions++;
    }
    return series;
  });

  app.get('/top-tools', { preHandler: resolveAuth }, async (req) => {
    const tenantId = req.auth!.tenantId;
    const range = (req.query as { range?: string }).range ?? '7d';
    const since = new Date(Date.now() - (RANGES[range] ?? RANGES['7d']!));
    const prisma = getPrisma();
    const rows = await prisma.auditLogEntry.groupBy({
      by: ['resource', 'action'],
      where: {
        tenantId,
        timestamp: { gte: since },
        resource: { not: null },
        action: { in: ['TOOL_CALL_EXECUTED', 'TOOL_CALL_BLOCKED', 'APPROVAL_REQUESTED'] },
      },
      _count: true,
    });
    const byResource = new Map<string, { tool: string; executed: number; blocked: number; approvals: number }>();
    for (const row of rows) {
      if (!row.resource) continue;
      const key = row.resource;
      const cur = byResource.get(key) ?? { tool: key, executed: 0, blocked: 0, approvals: 0 };
      if (row.action === 'TOOL_CALL_EXECUTED') cur.executed = row._count;
      if (row.action === 'TOOL_CALL_BLOCKED') cur.blocked = row._count;
      if (row.action === 'APPROVAL_REQUESTED') cur.approvals = row._count;
      byResource.set(key, cur);
    }
    return [...byResource.values()]
      .sort((a, b) => b.executed + b.blocked + b.approvals - (a.executed + a.blocked + a.approvals))
      .slice(0, 25);
  });
};
