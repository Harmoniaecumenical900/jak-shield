import { DecisionAction, RiskLevel } from '@jak-shield/shared';
import type { PolicyDecision } from '@jak-shield/shared';

export function allowDecision(reason = 'No policy violations detected'): PolicyDecision {
  return {
    action: DecisionAction.ALLOW,
    risk: RiskLevel.LOW,
    reason,
  };
}

export function blockDecision(reason: string, rule: string, risk = RiskLevel.HIGH, safeAlternative?: string): PolicyDecision {
  return {
    action: DecisionAction.BLOCK,
    risk,
    reason,
    rule,
    safeAlternative,
  };
}

export function approvalDecision(reason: string, rule: string, risk = RiskLevel.HIGH, safeAlternative?: string): PolicyDecision {
  return {
    action: DecisionAction.REQUIRES_APPROVAL,
    risk,
    reason,
    rule,
    safeAlternative,
  };
}

export function redactDecision(redactedArgs: Record<string, unknown>, reason: string, rule: string): PolicyDecision {
  return {
    action: DecisionAction.REDACT,
    risk: RiskLevel.MEDIUM,
    reason,
    rule,
    redactedArgs,
  };
}

export function rewriteDecision(safeAlternative: string, reason: string, rule: string): PolicyDecision {
  return {
    action: DecisionAction.REWRITE,
    risk: RiskLevel.MEDIUM,
    reason,
    rule,
    safeAlternative,
  };
}

export function isHardBlock(decision: PolicyDecision): boolean {
  return decision.action === DecisionAction.BLOCK;
}

export function decisionToJson(decision: PolicyDecision): Record<string, unknown> {
  return {
    action: decision.action,
    risk: decision.risk,
    reason: decision.reason,
    rule: decision.rule,
    safe_alternative: decision.safeAlternative,
    requires_role: decision.requiresRole,
    classifier: decision.classifierAdvice,
    approval_id: decision.approvalId,
    metadata: decision.metadata,
    provenance: decision.provenance,
    compliance: decision.compliance,
    signature: decision.signature,
    decision_id: decision.decisionId,
  };
}
