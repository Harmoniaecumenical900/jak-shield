import { AuditAction, AuditSeverity } from '@jak-shield/shared';
import { newAuditId } from '@jak-shield/core';
import { redactJsonForPersistence } from '@jak-shield/dlp';
import type { AuditEntry, AuditQueryFilter, AuditSink } from './sink.js';
import { ConsoleAuditSink } from './sink.js';

export interface AuditLogInput {
  tenantId: string;
  action: AuditAction;
  severity?: AuditSeverity;
  userId?: string;
  agentId?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

export class AuditLogger {
  constructor(private readonly sink: AuditSink = new ConsoleAuditSink()) {}

  async log(input: AuditLogInput): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: newAuditId(),
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      action: input.action,
      severity: input.severity ?? AuditSeverity.INFO,
      resource: input.resource,
      details: redactJsonForPersistence(input.details ?? {}) as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    };
    try {
      await this.sink.write(entry);
    } catch (err) {
      // Audit must never throw upstream — fall back to stderr only.
      // eslint-disable-next-line no-console
      console.error('[audit-log] sink.write failed', err);
    }
    return entry;
  }

  async query(filter: AuditQueryFilter): Promise<AuditEntry[]> {
    return this.sink.query(filter);
  }
}

let defaultInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (defaultInstance) return defaultInstance;
  if (process.env.DATABASE_URL) {
    // Lazy import so console-only deployments don't pull in @prisma/client.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaAuditSink } = require('./prisma-sink.js') as typeof import('./prisma-sink.js');
    defaultInstance = new AuditLogger(new PrismaAuditSink());
  } else {
    defaultInstance = new AuditLogger();
  }
  return defaultInstance;
}

export function setAuditLogger(logger: AuditLogger): void {
  defaultInstance = logger;
}
