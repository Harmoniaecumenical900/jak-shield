import { z } from 'zod';
import { ApprovalStatus, AuditAction, AuditSeverity, RiskLevel, UserRole, type PolicyDecision } from '@jak-shield/shared';

/**
 * Convert a JSON-RPC supplied context (plain string fields) into the partial
 * ToolCallContext shape that makeContext() accepts. Replaces the previous
 * `role as never` casts.
 */
function ctxFrom(raw: Record<string, string> | undefined): Parameters<typeof makeContext>[0] {
  if (!raw) return {};
  const out: Parameters<typeof makeContext>[0] = {
    tenantId: raw.tenantId,
    userId: raw.userId,
    agentId: raw.agentId,
    sessionId: raw.sessionId,
    clientName: raw.clientName,
  };
  if (raw.role && (Object.values(UserRole) as string[]).includes(raw.role)) {
    out.role = raw.role as UserRole;
  }
  return out;
}
import { detectInjection, detectInjectionV2, sanitizeToolOutput } from '@jak-shield/prompt-shield';
import { detectPII, detectPIIv2, redactPII, scanAndRedact, scanAndRedactObject } from '@jak-shield/dlp';
import { detectSecrets } from '@jak-shield/dlp';
import { getApprovalQueue } from '@jak-shield/approval-gateway';
import { getAuditLogger } from '@jak-shield/audit-log';
import { listConnectorTools } from '@jak-shield/connectors-registry';
import { decisionToJson, verifyDecisionSignature } from '@jak-shield/core';
import {
  acceptOverride,
  anomalySnapshot,
  endScrutiny,
  getScrutiny,
  issueCapability,
  taintSessionSnapshot,
  tagCompliance,
  verifyCapability,
} from '@jak-shield/policy-engine';
import { evaluateAndMaybeExecute, makeContext } from './evaluate.js';

export interface ShieldToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

const ContextSchema = z.object({
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  role: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  clientName: z.string().optional(),
}).optional();

export const SHIELD_TOOLS: ShieldToolDefinition[] = [
  {
    name: 'shield.evaluate_tool_call',
    description: 'Evaluate a planned tool call against JAK Shield policies and return a decision. Does NOT execute the tool.',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      context: ContextSchema,
    }),
    async handler(input) {
      const { tool_name, args, context } = input as { tool_name: string; args: Record<string, unknown>; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(context));
      const { decision } = await evaluateAndMaybeExecute({ toolName: tool_name, args: args ?? {}, context: ctx }, { });
      return decisionToJson(decision);
    },
  },
  {
    name: 'shield.proxy_tool_call',
    description: 'Evaluate AND execute a tool call through JAK Shield. Returns the decision plus the tool result (if allowed).',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      context: ContextSchema,
    }),
    async handler(input) {
      const { tool_name, args, context } = input as { tool_name: string; args: Record<string, unknown>; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(context));
      const { decision, result } = await evaluateAndMaybeExecute({ toolName: tool_name, args: args ?? {}, context: ctx }, {});
      return { decision: decisionToJson(decision), result };
    },
  },
  {
    name: 'shield.scan_input',
    description: 'Scan a string for PII, secrets, and prompt-injection patterns. Returns findings without acting on them.',
    inputSchema: z.object({ text: z.string() }),
    async handler(input) {
      const { text } = input as { text: string };
      const pii = detectPII(text);
      const secrets = detectSecrets(text);
      const injection = detectInjection(text);
      return {
        pii: { found: pii.found, count: pii.matches.length },
        secrets: { found: secrets.found, count: secrets.matches.length },
        injection,
        redacted_preview: scanAndRedact(text).redacted.slice(0, 1000),
      };
    },
  },
  {
    name: 'shield.scan_output',
    description: 'Scan a tool output and wrap it as untrusted data if injection patterns are detected.',
    inputSchema: z.object({ text: z.string(), source: z.enum(['tool', 'browser', 'file']).default('tool') }),
    async handler(input) {
      const { text, source } = input as { text: string; source: 'tool' | 'browser' | 'file' };
      return sanitizeToolOutput(text, source);
    },
  },
  {
    name: 'shield.redact_sensitive_data',
    description: 'Redact PII and secrets from a string OR a JSON object.',
    inputSchema: z.object({
      text: z.string().optional(),
      object: z.record(z.unknown()).optional(),
    }),
    async handler(input) {
      const i = input as { text?: string; object?: Record<string, unknown> };
      if (i.text != null) return { redacted: redactPII(i.text), kind: 'string' };
      if (i.object != null) return { redacted: scanAndRedactObject(i.object).redacted, kind: 'object' };
      return { error: 'Provide either text or object' };
    },
  },
  {
    name: 'shield.detect_prompt_injection',
    description: 'Detect prompt-injection patterns in a string. Set is_browser_content=true for scraped HTML.',
    inputSchema: z.object({ text: z.string(), is_browser_content: z.boolean().default(false) }),
    async handler(input) {
      const { text, is_browser_content } = input as { text: string; is_browser_content: boolean };
      return detectInjection(text, is_browser_content);
    },
  },
  {
    name: 'shield.require_approval',
    description: 'Manually enqueue an approval request for a planned action.',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      reason: z.string(),
      risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { tool_name: string; args: Record<string, unknown>; reason: string; risk: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const queue = getApprovalQueue();
      const created = await queue.create({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        agentId: ctx.agentId,
        toolName: i.tool_name,
        argsRedacted: scanAndRedactObject(i.args ?? {}).redacted,
        reason: i.reason,
        risk: RiskLevel[i.risk],
      });
      await getAuditLogger().log({
        tenantId: ctx.tenantId,
        action: AuditAction.APPROVAL_REQUESTED,
        severity: AuditSeverity.WARN,
        resource: i.tool_name,
        details: { approvalId: created.id, reason: i.reason },
      });
      return created;
    },
  },
  {
    name: 'shield.audit_event',
    description: 'Write a custom audit event for an action the agent took or considered.',
    inputSchema: z.object({
      action: z.string(),
      resource: z.string().optional(),
      severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).default('INFO'),
      details: z.record(z.unknown()).default({}),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { action: string; resource?: string; severity: 'INFO'|'WARN'|'ERROR'|'CRITICAL'; details: Record<string, unknown>; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const entry = await getAuditLogger().log({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: i.action as AuditAction,
        severity: i.severity as AuditSeverity,
        resource: i.resource,
        details: i.details,
      });
      return entry;
    },
  },
  {
    name: 'shield.block_action',
    description: 'Explicitly mark an action as blocked and write an audit entry. Use when the agent decides not to proceed.',
    inputSchema: z.object({
      tool_name: z.string(),
      reason: z.string(),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { tool_name: string; reason: string; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      await getAuditLogger().log({
        tenantId: ctx.tenantId,
        action: AuditAction.TOOL_CALL_BLOCKED,
        severity: AuditSeverity.WARN,
        resource: i.tool_name,
        details: { reason: i.reason, blockedByAgent: true },
      });
      return { blocked: true, reason: i.reason };
    },
  },
  {
    name: 'shield.rewrite_safe_action',
    description: 'Suggest a safer rewrite of a tool call (uses the OpenAI classifier if configured, otherwise heuristic).',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { tool_name: string; args: Record<string, unknown>; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const { decision } = await evaluateAndMaybeExecute({ toolName: i.tool_name, args: i.args ?? {}, context: ctx }, {});
      return {
        original: { tool_name: i.tool_name, args: scanAndRedactObject(i.args ?? {}).redacted },
        decision: decisionToJson(decision),
        safe_rewrite: decision.safeAlternative ?? decision.classifierAdvice?.safeRewrite ?? null,
      };
    },
  },
  {
    name: 'shield.list_protected_tools',
    description: 'List all tools currently registered behind JAK Shield with their risk class.',
    inputSchema: z.object({}),
    async handler() {
      return listConnectorTools();
    },
  },
  {
    name: 'shield.check_approval',
    description: 'Check the status of a previously-enqueued approval request.',
    inputSchema: z.object({ approval_id: z.string() }),
    async handler(input) {
      const { approval_id } = input as { approval_id: string };
      const rec = await getApprovalQueue().get(approval_id);
      if (!rec) return { error: 'not_found' };
      return rec;
    },
  },
  {
    name: 'shield.list_pending_approvals',
    description: 'List pending approval requests for the current tenant.',
    inputSchema: z.object({ context: ContextSchema, limit: z.number().default(50) }),
    async handler(input) {
      const i = input as { context?: Record<string, string>; limit: number };
      const ctx = makeContext(ctxFrom(i.context));
      const rows = await getApprovalQueue().list(ctx.tenantId, ApprovalStatus.PENDING, i.limit);
      return rows;
    },
  },

  // ─── v2 capability tools (Phase 4 differentiators) ────────────────────

  {
    name: 'shield.explain_decision',
    description: 'Return the full evidence tree, signature, and compliance tags for a planned tool call. Use this to render "why was this blocked?" UIs.',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { tool_name: string; args: Record<string, unknown>; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const { decision } = await evaluateAndMaybeExecute({ toolName: i.tool_name, args: i.args ?? {}, context: ctx }, {});
      return {
        action: decision.action,
        rule: decision.rule,
        risk: decision.risk,
        reason: decision.reason,
        safe_alternative: decision.safeAlternative,
        compliance: decision.compliance ?? [],
        provenance: decision.provenance,
        signature: decision.signature,
        signature_valid: verifyDecisionSignature(decision),
        decision_id: decision.decisionId,
        approval_id: decision.approvalId,
        approval_queued: Boolean(decision.approvalId),
      };
    },
  },

  {
    name: 'shield.issue_capability_token',
    description: 'Issue a short-lived, single-use, scoped capability token bound to exactly one tool call (tenant + tool name + args hash). Even if intercepted, the token cannot be used for any other call.',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      ttl_seconds: z.number().default(60),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { tool_name: string; args: Record<string, unknown>; ttl_seconds: number; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const token = issueCapability({
        tenantId: ctx.tenantId,
        toolName: i.tool_name,
        args: i.args ?? {},
        ttlSeconds: i.ttl_seconds,
      });
      return { token, tool_name: i.tool_name, expires_in_seconds: i.ttl_seconds };
    },
  },

  {
    name: 'shield.verify_capability_token',
    description: 'Verify a capability token. Single-use: if valid, it is burned and cannot be re-used.',
    inputSchema: z.object({
      token: z.string(),
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as { token: string; tool_name: string; args: Record<string, unknown>; context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      return verifyCapability(i.token, { tenantId: ctx.tenantId, toolName: i.tool_name, args: i.args ?? {} });
    },
  },

  {
    name: 'shield.taint_snapshot',
    description: 'Return the current taint records for the session — every tool output JAK Shield has tagged as UNTRUSTED / INTERNAL / SENSITIVE.',
    inputSchema: z.object({ context: ContextSchema }),
    async handler(input) {
      const i = input as { context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const records = taintSessionSnapshot(ctx.sessionId ?? ctx.requestId);
      return { session: ctx.sessionId ?? ctx.requestId, records };
    },
  },

  {
    name: 'shield.anomaly_snapshot',
    description: 'Return the per-tool call counts for the tenant over the last 24h — what the anomaly detector compares against.',
    inputSchema: z.object({ context: ContextSchema }),
    async handler(input) {
      const i = input as { context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      return { tenant: ctx.tenantId, counts: anomalySnapshot(ctx.tenantId) };
    },
  },

  {
    name: 'shield.compliance_tag',
    description: 'Auto-tag a planned tool call with regulatory frameworks (PCI/HIPAA/GDPR/SOX/FERPA/DPDP).',
    inputSchema: z.object({
      tool_name: z.string(),
      args: z.record(z.unknown()).default({}),
    }),
    async handler(input) {
      const i = input as { tool_name: string; args: Record<string, unknown> };
      const flat = Object.values(i.args ?? {}).filter((v) => typeof v === 'string').join('\n');
      const piiScan = detectPIIv2(flat);
      const tags = tagCompliance({ toolName: i.tool_name, args: i.args ?? {}, piiFindings: piiScan.findings });
      return { tags, pii_types: [...new Set(piiScan.findings.map((f) => f.type))] };
    },
  },

  {
    name: 'shield.scan_input_v2',
    description: 'Defense-in-depth scan: standard regex + Unicode confusables + base64/hex decode + HTML/JSON structural + multilingual + PII with checksum validators. Returns the full evidence tree.',
    inputSchema: z.object({ text: z.string() }),
    async handler(input) {
      const { text } = input as { text: string };
      const injection = detectInjectionV2(text);
      const pii = detectPIIv2(text);
      const secrets = detectSecrets(text);
      return {
        injection,
        pii: {
          findings: pii.findings.map((f) => ({
            type: f.type,
            confidence: f.confidence,
            validators: f.validators,
            sample: f.sample.slice(0, 6) + '…',
            contextHint: f.contextHint,
          })),
          maxConfidence: pii.maxConfidence,
          redacted: pii.redacted,
        },
        secrets: { found: secrets.found, count: secrets.matches.length },
      };
    },
  },

  {
    name: 'shield.override_block',
    description:
      'Accept the risk on an overridable BLOCK decision and proceed. Returns a single-use override token AND starts a heightened-scrutiny window — the next ~10 tool calls in this session run with tightened anomaly + taint thresholds, and any further block in that window is NOT overridable. CRITICAL-risk blocks (e.g. rm -rf /, DROP TABLE without WHERE, prod-deploy without ticket) are never overridable; this tool returns an error for them. Audit-logged.',
    inputSchema: z.object({
      blocked_decision: z.record(z.unknown()).describe('The full PolicyDecision the BLOCK tool returned, including its signature and override field. Tampering will fail signature verification.'),
      human_reason: z.string().min(8).describe('Why the human is overriding. Required, at least 8 characters. Logged verbatim.'),
      accepted_by: z.string().describe('User id of the human accepting the risk. Logged.'),
      context: ContextSchema,
    }),
    async handler(input) {
      const i = input as {
        blocked_decision: PolicyDecision;
        human_reason: string;
        accepted_by: string;
        context?: Record<string, string>;
      };
      const ctx = makeContext(ctxFrom(i.context));
      const sessionId = ctx.sessionId ?? ctx.requestId;
      const result = acceptOverride({
        blockedDecision: i.blocked_decision,
        tenantId: ctx.tenantId,
        sessionId,
        humanReason: i.human_reason,
        acceptedBy: i.accepted_by,
      });

      // Audit every override attempt — accepted or rejected.
      try {
        const auditor = getAuditLogger();
        await auditor.log({
          tenantId: ctx.tenantId,
          userId: i.accepted_by,
          action: AuditAction.POLICY_DECISION_OVERRIDDEN,
          severity: result.ok ? AuditSeverity.WARN : AuditSeverity.INFO,
          resource: i.blocked_decision.rule ?? 'unknown-rule',
          details: result.ok
            ? {
                blockId: i.blocked_decision.decisionId,
                sessionId,
                expiresAt: result.expiresAt,
                scrutinyCalls: result.scrutinyCalls,
                reason: i.human_reason,
              }
            : {
                blockId: i.blocked_decision.decisionId,
                sessionId,
                refusedReason: result.reason,
                code: result.code,
              },
        });
      } catch {
        // Auditor failures shouldn't block the override response itself.
      }

      if (!result.ok) {
        return {
          ok: false,
          code: result.code,
          reason: result.reason,
        };
      }
      return {
        ok: true,
        override_token: result.overrideToken,
        expires_at: result.expiresAt,
        scrutiny_calls: result.scrutinyCalls,
        scrutiny_note:
          'JAK Shield is still watching. Anomaly + taint thresholds are tightened for the next ' +
          result.scrutinyCalls +
          ' calls in this session. Any further block in that window is NOT overridable.',
        audit_note: result.auditNote,
      };
    },
  },

  {
    name: 'shield.scrutiny_status',
    description:
      'Inspect the heightened-scrutiny state for the current session — calls remaining, what triggered scrutiny, and any warnings accumulated since the override.',
    inputSchema: z.object({ context: ContextSchema }),
    async handler(input) {
      const i = input as { context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const sessionId = ctx.sessionId ?? ctx.requestId;
      const state = getScrutiny(ctx.tenantId, sessionId);
      if (!state) {
        return { active: false, session: sessionId };
      }
      return {
        active: true,
        session: sessionId,
        calls_remaining: state.callsRemaining,
        triggered_by: state.triggeredBy,
        original_block_id: state.originalBlockId,
        thresholds: state.thresholds,
        warnings: state.warnings,
      };
    },
  },

  {
    name: 'shield.stand_down',
    description:
      'End the heightened-scrutiny window early for this session. Use when the override is complete and you want normal thresholds restored before the call counter expires. Audit-logged.',
    inputSchema: z.object({ context: ContextSchema }),
    async handler(input) {
      const i = input as { context?: Record<string, string> };
      const ctx = makeContext(ctxFrom(i.context));
      const sessionId = ctx.sessionId ?? ctx.requestId;
      const wasActive = !!getScrutiny(ctx.tenantId, sessionId);
      endScrutiny(ctx.tenantId, sessionId);
      try {
        const auditor = getAuditLogger();
        await auditor.log({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: AuditAction.SCRUTINY_ENDED,
          severity: AuditSeverity.INFO,
          resource: 'scrutiny:stand_down',
          details: { sessionId, wasActive },
        });
      } catch {
        /* audit failures shouldn't block the response */
      }
      return { ok: true, session: sessionId, was_active: wasActive };
    },
  },
];
