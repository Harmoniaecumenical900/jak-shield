import type { FastifyPluginAsync } from 'fastify';
import { AuditAction, AuditSeverity } from '@jak-shield/shared';
import { getAuditLogger } from '@jak-shield/audit-log';

export const auditRoutes: FastifyPluginAsync = async (app) => {
  const audit = getAuditLogger();

  app.get('/', async (req) => {
    const q = req.query as { tenantId?: string; action?: string; severity?: string; limit?: string };
    return audit.query({
      tenantId: q.tenantId ?? process.env.SHIELD_DEFAULT_TENANT_ID ?? 'local',
      action: q.action as AuditAction | undefined,
      severity: q.severity as AuditSeverity | undefined,
      limit: q.limit ? Number(q.limit) : 200,
    });
  });
};
