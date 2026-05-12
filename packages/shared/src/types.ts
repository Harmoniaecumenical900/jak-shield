import { DecisionAction, RiskLevel, ToolRiskClass, UserRole } from './enums.js';

export interface ToolCallContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  agentId?: string;
  sessionId?: string;
  clientName?: string;
  requestId: string;
  timestamp: string;
}

export interface ToolCallRequest {
  toolName: string;
  args: Record<string, unknown>;
  context: ToolCallContext;
}

export interface ToolMetadata {
  name: string;
  description?: string;
  riskClass?: ToolRiskClass;
  requiresApproval?: boolean;
  provider?: string;
  inputSchema?: Record<string, unknown>;
}

export interface PolicyDecision {
  action: DecisionAction;
  risk: RiskLevel;
  reason: string;
  rule?: string;
  safeAlternative?: string;
  requiresRole?: UserRole;
  redactedArgs?: Record<string, unknown>;
  classifierAdvice?: ClassifierAdvice | null;
  approvalId?: string;
  metadata?: Record<string, unknown>;
  /** Tamper-evident HMAC over the canonicalized decision (excluding this field). */
  signature?: string;
  /** Full reasoning tree: every detector that fired, what it found, how it contributed. */
  provenance?: DecisionProvenance;
  /** Compliance frameworks implicated by this call (PCI, HIPAA, GDPR, SOX). */
  compliance?: ComplianceTag[];
  /** Decision id for cross-referencing logs + chains. */
  decisionId?: string;
}

export interface DecisionProvenance {
  evidence: Evidence[];
  /** The rule or stage that produced the final action. */
  decidedBy: string;
  /** Cumulative risk score from all detectors (0..1). */
  aggregateRiskScore: number;
  /** Whether the OpenAI classifier was consulted and what it said. */
  classifier?: { used: boolean; agreed: boolean; advice?: ClassifierAdvice | null };
  /** Behavioral baseline check, if applied. */
  anomaly?: { detected: boolean; score: number; baseline?: number; observed?: number };
  /** Cross-call chain analysis. */
  chain?: { matched: string | null; recentTools: string[] };
}

export interface Evidence {
  /** Stage that emitted this evidence — pii-detector, injection-detector, rbac, etc. */
  source: string;
  /** Severity contribution to the final decision. */
  weight: number;
  /** Short human-readable description. */
  detail: string;
  /** Pointer back to the input field that triggered it. */
  field?: string;
  /** Confidence 0..1 — distinct from weight. */
  confidence?: number;
  /** Validators that confirmed the finding (e.g. ['regex', 'luhn', 'context']). */
  validators?: string[];
  /** Optional snippet of the matched value (already redacted). */
  sample?: string;
}

export enum ComplianceTag {
  PCI_DSS = 'PCI_DSS',
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  SOX = 'SOX',
  CCPA = 'CCPA',
  DPDP = 'DPDP',  // India
  FERPA = 'FERPA', // Education
}

export interface ClassifierAdvice {
  risk: number;
  intentClass: string;
  suggestedAction: DecisionAction;
  safeRewrite?: string;
  rationale: string;
  source: 'openai' | 'fallback';
  latencyMs: number;
  cached?: boolean;
}

export interface PIIFinding {
  type: string;
  count: number;
  samples: string[];
}

export interface ScanResult {
  found: PIIFinding[];
  redacted: string;
  hasPii: boolean;
  hasSecrets: boolean;
}

export interface InjectionResult {
  detected: boolean;
  patterns: string[];
  risk: 'LOW' | 'HIGH';
  confidence: number;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  redacted?: boolean;
  injectionDetectedInOutput?: boolean;
}

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  toolName: string;
  argsRedacted: Record<string, unknown>;
  reason: string;
  risk: RiskLevel;
  status: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  expiresAt?: string;
}
