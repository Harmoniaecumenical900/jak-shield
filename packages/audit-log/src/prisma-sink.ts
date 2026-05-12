import { getPrisma } from '@jak-shield/approval-gateway';
import type { AuditEntry, AuditQueryFilter, AuditSink } from './sink.js';
import type { AuditAction, AuditSeverity } from '@jak-shield/shared';

export class PrismaAuditSink implements AuditSink {
  private prisma = getPrisma();

  async write(entry: AuditEntry): Promise<void> {
    // Ensure the tenant exists (idempotent) — the MCP gateway is sometimes the
    // first writer for a brand-new tenant.
    await this.prisma.tenant.upsert({
      where: { id: entry.tenantId },
      create: { id: entry.tenantId, name: entry.tenantId },
      update: {},
    });
    await this.prisma.auditLogEntry.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        userId: entry.userId,
        agentId: entry.agentId,
        action: entry.action,
        severity: entry.severity,
        resource: entry.resource,
        details: entry.details as object,
        timestamp: new Date(entry.timestamp),
      },
    });
  }

  async query(filter: AuditQueryFilter): Promise<AuditEntry[]> {
    const where: Record<string, unknown> = {};
    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.action) where.action = filter.action;
    if (filter.severity) where.severity = filter.severity;
    if (filter.since || filter.until) {
      const ts: Record<string, Date> = {};
      if (filter.since) ts.gte = new Date(filter.since);
      if (filter.until) ts.lte = new Date(filter.until);
      where.timestamp = ts;
    }
    type FindMany = Parameters<typeof this.prisma.auditLogEntry.findMany>[0];
    const rows = (await this.prisma.auditLogEntry.findMany({
      where: where as FindMany extends { where?: infer W } ? W : never,
      orderBy: { timestamp: 'desc' },
      take: filter.limit ?? 200,
    })) as Array<{
      id: string;
      tenantId: string;
      userId: string | null;
      agentId: string | null;
      action: string;
      severity: string;
      resource: string | null;
      details: unknown;
      timestamp: Date;
    }>;
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      userId: r.userId ?? undefined,
      agentId: r.agentId ?? undefined,
      action: r.action as AuditAction,
      severity: r.severity as AuditSeverity,
      resource: r.resource ?? undefined,
      details: (r.details ?? {}) as Record<string, unknown>,
      timestamp: r.timestamp.toISOString(),
    }));
  }
}
