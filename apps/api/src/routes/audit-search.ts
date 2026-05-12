import type { FastifyPluginAsync } from 'fastify';
import { getPrisma } from '@jak-shield/approval-gateway';
import { resolveAuth } from '../middleware/auth.js';

interface SearchQuery {
  q?: string;
  action?: string;
  severity?: string;
  resource?: string;
  since?: string;
  until?: string;
  limit?: string;
  offset?: string;
  format?: 'json' | 'csv';
}

export const auditSearchRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: resolveAuth }, async (req, reply) => {
    const q = req.query as SearchQuery;
    const tenantId = req.auth!.tenantId;
    const limit = Math.min(Number(q.limit ?? 200), 1000);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const where: Record<string, unknown> = { tenantId };
    if (q.action) where.action = q.action;
    if (q.severity) where.severity = q.severity;
    if (q.resource) where.resource = { contains: q.resource };
    if (q.since || q.until) {
      const ts: Record<string, Date> = {};
      if (q.since) ts.gte = new Date(q.since);
      if (q.until) ts.lte = new Date(q.until);
      where.timestamp = ts;
    }
    if (q.q) {
      // Simple JSON-string search across details. Postgres-only.
      where.OR = [
        { resource: { contains: q.q, mode: 'insensitive' } },
        { details: { string_contains: q.q } },
      ];
    }

    const prisma = getPrisma();
    const [rows, total] = await Promise.all([
      prisma.auditLogEntry.findMany({
        where: where as Record<string, unknown>,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLogEntry.count({ where: where as Record<string, unknown> }),
    ]);

    if (q.format === 'csv') {
      reply.header('content-type', 'text/csv');
      reply.header('content-disposition', `attachment; filename=audit-${Date.now()}.csv`);
      const lines = ['id,timestamp,action,severity,resource,details'];
      for (const r of rows) {
        lines.push([
          r.id,
          r.timestamp.toISOString(),
          r.action,
          r.severity,
          escape(r.resource ?? ''),
          escape(JSON.stringify(r.details)),
        ].join(','));
      }
      return reply.send(lines.join('\n'));
    }
    return { total, limit, offset, rows };
  });
};

function escape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
