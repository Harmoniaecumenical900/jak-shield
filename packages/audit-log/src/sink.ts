import { AuditAction, AuditSeverity, createLogger } from '@jak-shield/shared';

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId?: string;
  agentId?: string;
  action: AuditAction;
  severity: AuditSeverity;
  resource?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface AuditSink {
  write(entry: AuditEntry): Promise<void>;
  query(filter: AuditQueryFilter): Promise<AuditEntry[]>;
}

export interface AuditQueryFilter {
  tenantId?: string;
  action?: AuditAction;
  severity?: AuditSeverity;
  since?: string;
  until?: string;
  limit?: number;
}

const log = createLogger('audit-log:console-sink');

export class ConsoleAuditSink implements AuditSink {
  private entries: AuditEntry[] = [];

  async write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
    log.info({ action: entry.action, severity: entry.severity, tenant: entry.tenantId, resource: entry.resource });
  }

  async query(filter: AuditQueryFilter): Promise<AuditEntry[]> {
    let out = this.entries;
    if (filter.tenantId) out = out.filter((e) => e.tenantId === filter.tenantId);
    if (filter.action) out = out.filter((e) => e.action === filter.action);
    if (filter.severity) out = out.filter((e) => e.severity === filter.severity);
    if (filter.since) out = out.filter((e) => e.timestamp >= filter.since!);
    if (filter.until) out = out.filter((e) => e.timestamp <= filter.until!);
    if (filter.limit) out = out.slice(-filter.limit);
    return out;
  }
}
