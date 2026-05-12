import { ApprovalStatus } from '@jak-shield/shared';
import type { ApprovalRecord } from '@jak-shield/shared';
import { newApprovalId } from '@jak-shield/core';
import type { ApprovalQueue, CreateApprovalInput, DecideApprovalInput } from './queue.js';

const DEFAULT_TTL_SEC = Number(process.env.SHIELD_APPROVAL_TTL_SEC ?? 60 * 60 * 24);

export class InMemoryApprovalQueue implements ApprovalQueue {
  private store = new Map<string, ApprovalRecord>();

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    const id = newApprovalId();
    const now = new Date();
    const ttl = (input.expiresInSeconds ?? DEFAULT_TTL_SEC) * 1000;
    const record: ApprovalRecord = {
      id,
      tenantId: input.tenantId,
      toolName: input.toolName,
      argsRedacted: input.argsRedacted,
      reason: input.reason,
      risk: input.risk,
      status: ApprovalStatus.PENDING,
      requestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
    };
    this.store.set(id, record);
    return record;
  }

  async get(id: string): Promise<ApprovalRecord | null> {
    return this.store.get(id) ?? null;
  }

  async list(tenantId: string, status?: ApprovalStatus, limit = 100): Promise<ApprovalRecord[]> {
    const all = Array.from(this.store.values()).filter((r) => r.tenantId === tenantId);
    const filtered = status ? all.filter((r) => r.status === status) : all;
    return filtered.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).slice(0, limit);
  }

  async decide(input: DecideApprovalInput): Promise<ApprovalRecord> {
    const existing = this.store.get(input.id);
    if (!existing) throw new Error(`Approval not found: ${input.id}`);
    const updated: ApprovalRecord = {
      ...existing,
      status: input.status,
      decidedBy: input.decidedBy,
      decidedAt: new Date().toISOString(),
    };
    this.store.set(input.id, updated);
    return updated;
  }

  async expireStale(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [id, record] of this.store.entries()) {
      if (record.status === ApprovalStatus.PENDING && record.expiresAt && new Date(record.expiresAt).getTime() < now) {
        this.store.set(id, { ...record, status: ApprovalStatus.EXPIRED, decidedAt: new Date().toISOString() });
        count++;
      }
    }
    return count;
  }
}
