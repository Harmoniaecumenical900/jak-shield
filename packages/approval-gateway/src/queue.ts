import { ApprovalStatus, RiskLevel } from '@jak-shield/shared';
import type { ApprovalRecord } from '@jak-shield/shared';

export interface CreateApprovalInput {
  tenantId: string;
  userId?: string;
  agentId?: string;
  toolName: string;
  argsRedacted: Record<string, unknown>;
  reason: string;
  rule?: string;
  risk: RiskLevel;
  expiresInSeconds?: number;
}

export interface DecideApprovalInput {
  id: string;
  decidedBy: string;
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED | ApprovalStatus.DEFERRED;
  note?: string;
}

export interface ApprovalQueue {
  create(input: CreateApprovalInput): Promise<ApprovalRecord>;
  get(id: string): Promise<ApprovalRecord | null>;
  list(tenantId: string, status?: ApprovalStatus, limit?: number): Promise<ApprovalRecord[]>;
  decide(input: DecideApprovalInput): Promise<ApprovalRecord>;
  expireStale(): Promise<number>;
}
