import { ApprovalStatus } from '@jak-shield/shared';
import type { ApprovalRecord } from '@jak-shield/shared';
import { newApprovalId } from '@jak-shield/core';
import type { ApprovalQueue, CreateApprovalInput, DecideApprovalInput } from './queue.js';
import { getPrisma } from './client.js';

const DEFAULT_TTL_SEC = Number(process.env.SHIELD_APPROVAL_TTL_SEC ?? 60 * 60 * 24);

export class PrismaApprovalQueue implements ApprovalQueue {
  private prisma = getPrisma();

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    const id = newApprovalId();
    const ttl = (input.expiresInSeconds ?? DEFAULT_TTL_SEC) * 1000;
    const expiresAt = new Date(Date.now() + ttl);
    await this.prisma.tenant.upsert({
      where: { id: input.tenantId },
      create: { id: input.tenantId, name: input.tenantId },
      update: {},
    });
    const created = await this.prisma.approvalRequest.create({
      data: {
        id,
        tenantId: input.tenantId,
        userId: input.userId,
        agentId: input.agentId,
        toolName: input.toolName,
        argsRedacted: input.argsRedacted as object,
        reason: input.reason,
        rule: input.rule,
        risk: input.risk,
        status: ApprovalStatus.PENDING,
        expiresAt,
      },
    });
    return toRecord(created);
  }

  async get(id: string): Promise<ApprovalRecord | null> {
    const row = await this.prisma.approvalRequest.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async list(tenantId: string, status?: ApprovalStatus, limit = 100): Promise<ApprovalRecord[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async decide(input: DecideApprovalInput): Promise<ApprovalRecord> {
    const updated = await this.prisma.approvalRequest.update({
      where: { id: input.id },
      data: {
        status: input.status,
        decidedBy: input.decidedBy,
        decidedAt: new Date(),
        decidedNote: input.note,
      },
    });
    return toRecord(updated);
  }

  async expireStale(): Promise<number> {
    const result = await this.prisma.approvalRequest.updateMany({
      where: { status: ApprovalStatus.PENDING, expiresAt: { lt: new Date() } },
      data: { status: ApprovalStatus.EXPIRED, decidedAt: new Date() },
    });
    return result.count;
  }
}

function toRecord(row: {
  id: string;
  tenantId: string;
  toolName: string;
  argsRedacted: unknown;
  reason: string;
  risk: string;
  status: string;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  expiresAt: Date | null;
}): ApprovalRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    toolName: row.toolName,
    argsRedacted: (row.argsRedacted ?? {}) as Record<string, unknown>,
    reason: row.reason,
    risk: row.risk as ApprovalRecord['risk'],
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString(),
    decidedBy: row.decidedBy ?? undefined,
    expiresAt: row.expiresAt?.toISOString(),
  };
}
