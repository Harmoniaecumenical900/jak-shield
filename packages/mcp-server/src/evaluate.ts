import { AuditAction, AuditSeverity, DecisionAction, RiskLevel, UserRole } from '@jak-shield/shared';
import type { PolicyDecision, ToolCallContext, ToolCallRequest, ToolExecutionResult } from '@jak-shield/shared';
import { decide } from '@jak-shield/policy-engine';
import { classify, isClassifierConfigured } from '@jak-shield/openai-classifier';
import { getAuditLogger } from '@jak-shield/audit-log';
import { getApprovalQueue } from '@jak-shield/approval-gateway';
import { getConnectorTool, runConnectorWithSanitization } from '@jak-shield/connectors-registry';
import { newRequestId, signDecision } from '@jak-shield/core';
import { scanAndRedactObject } from '@jak-shield/dlp';
import { withTenantCredentials } from '@jak-shield/auth';
import { getTenantContext } from './tenant-context.js';

export interface EvaluateOptions {
  enableClassifier?: boolean;
  approvalThreshold?: RiskLevel;
  /** Env-var names this tool needs from the per-tenant credential vault. */
  requiredCredentials?: string[];
}

const DEFAULT_TENANT_ID = process.env.SHIELD_DEFAULT_TENANT_ID ?? 'local';
const DEFAULT_USER_ID = process.env.SHIELD_DEFAULT_USER_ID ?? 'local-user';
const DEFAULT_ROLE = (process.env.SHIELD_DEFAULT_USER_ROLE as UserRole) ?? UserRole.TENANT_ADMIN;

export function makeContext(partial: Partial<ToolCallContext> = {}): ToolCallContext {
  // Honor the per-tenant context propagated via AsyncLocalStorage when present
  // (set by the HTTP MCP transport on each request). Falls back to env defaults.
  const ambient = getTenantContext();
  return {
    tenantId: partial.tenantId ?? ambient?.tenantId ?? DEFAULT_TENANT_ID,
    userId: partial.userId ?? ambient?.userId ?? DEFAULT_USER_ID,
    role: partial.role ?? ambient?.role ?? DEFAULT_ROLE,
    agentId: partial.agentId,
    sessionId: partial.sessionId,
    clientName: partial.clientName,
    requestId: partial.requestId ?? newRequestId(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
  };
}

const CONNECTOR_REQUIRED_ENV: Record<string, string[]> = {
  'gmail.send_email': ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
  'gmail.list_messages': ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
  'gmail.read_email': ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
  'github.create_issue': ['GITHUB_TOKEN'],
  'github.create_pr_comment': ['GITHUB_TOKEN'],
  'github.list_repos': ['GITHUB_TOKEN'],
  'supabase.query': ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
  'supabase.select': ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
  'postgres.query': ['PG_QUERY_URL'],
  'slack.send_message': ['SLACK_BOT_TOKEN'],
  'sms.send': ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'],
  'gdrive.list': ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GDRIVE_REFRESH_TOKEN'],
};

function envFor(toolName: string): string[] {
  return CONNECTOR_REQUIRED_ENV[toolName] ?? [];
}

/**
 * Evaluate a tool call: returns the policy decision and (if appropriate) the
 * tool execution result. Handles approval enqueueing and audit logging.
 */
export async function evaluateAndMaybeExecute(
  req: ToolCallRequest,
  options: EvaluateOptions = {},
): Promise<{ decision: PolicyDecision; result?: ToolExecutionResult }> {
  const audit = getAuditLogger();
  const { redacted: redactedArgs } = scanAndRedactObject(req.args ?? {});

  await audit.log({
    tenantId: req.context.tenantId,
    userId: req.context.userId,
    agentId: req.context.agentId,
    action: AuditAction.TOOL_CALL_RECEIVED,
    severity: AuditSeverity.INFO,
    resource: req.toolName,
    details: { args: redactedArgs, requestId: req.context.requestId, client: req.context.clientName },
  });

  // Run classifier in parallel with deterministic engine.
  const classifierEnabled = options.enableClassifier !== false && isClassifierConfigured();
  const classifierP = classifierEnabled
    ? classify({ toolName: req.toolName, redactedArgs, agentContext: { agentId: req.context.agentId, role: req.context.role } })
    : Promise.resolve(null);

  const advice = await classifierP;
  if (advice) {
    await audit.log({
      tenantId: req.context.tenantId,
      action: AuditAction.CLASSIFIER_INVOKED,
      severity: AuditSeverity.INFO,
      resource: req.toolName,
      details: { risk: advice.risk, intent: advice.intentClass, latencyMs: advice.latencyMs, cached: advice.cached === true },
    });
  }

  const decision = decide(req, { classifierAdvice: advice, approvalThreshold: options.approvalThreshold });

  await audit.log({
    tenantId: req.context.tenantId,
    userId: req.context.userId,
    action: AuditAction.POLICY_DECISION,
    severity: severityFor(decision.action),
    resource: req.toolName,
    details: {
      action: decision.action,
      rule: decision.rule,
      risk: decision.risk,
      reason: decision.reason,
      requestId: req.context.requestId,
    },
  });

  switch (decision.action) {
    case DecisionAction.BLOCK: {
      await audit.log({
        tenantId: req.context.tenantId,
        action: AuditAction.TOOL_CALL_BLOCKED,
        severity: AuditSeverity.WARN,
        resource: req.toolName,
        details: { reason: decision.reason, rule: decision.rule, requestId: req.context.requestId },
      });
      return { decision };
    }
    case DecisionAction.REQUIRES_APPROVAL: {
      const queue = getApprovalQueue();
      const created = await queue.create({
        tenantId: req.context.tenantId,
        userId: req.context.userId,
        agentId: req.context.agentId,
        toolName: req.toolName,
        argsRedacted: decision.redactedArgs ?? redactedArgs,
        reason: decision.reason,
        rule: decision.rule,
        risk: decision.risk,
      });
      await audit.log({
        tenantId: req.context.tenantId,
        action: AuditAction.APPROVAL_REQUESTED,
        severity: AuditSeverity.WARN,
        resource: req.toolName,
        details: { approvalId: created.id, reason: decision.reason },
      });
      // Re-sign so the approvalId mutation is covered by the signature.
      // Without this, downstream verifyDecisionSignature() sees a canonical
      // form that includes approvalId but a signature computed without it.
      const withApproval = signDecision({ ...decision, approvalId: created.id });
      return { decision: withApproval };
    }
    case DecisionAction.REWRITE: {
      // The agent should re-issue the safe alternative; we don't auto-execute.
      return { decision };
    }
    case DecisionAction.REDACT:
    case DecisionAction.ALLOW: {
      const tool = getConnectorTool(req.toolName);
      if (!tool) {
        return {
          decision: { ...decision },
          result: { success: false, error: `Tool '${req.toolName}' is not a registered connector. Use shield.evaluate_tool_call only.` },
        };
      }
      const argsToUse = decision.redactedArgs ?? req.args ?? {};
      const requiredEnv = options.requiredCredentials ?? envFor(req.toolName);

      const runner = async () => {
        try {
          tool.checkConfig?.();
        } catch (err) {
          await audit.log({
            tenantId: req.context.tenantId,
            action: AuditAction.CONNECTOR_AUTH_FAILURE,
            severity: AuditSeverity.ERROR,
            resource: req.toolName,
            details: { message: (err as Error).message },
          });
          return { success: false, error: (err as Error).message };
        }
        return runConnectorWithSanitization(tool, argsToUse, req.context, decision);
      };

      const result = requiredEnv.length > 0 && process.env.DATABASE_URL
        ? await withTenantCredentials(req.context.tenantId, requiredEnv, runner)
        : await runner();

      await audit.log({
        tenantId: req.context.tenantId,
        userId: req.context.userId,
        action: result.success ? AuditAction.TOOL_CALL_EXECUTED : AuditAction.TOOL_CALL_FAILED,
        severity: result.success ? AuditSeverity.INFO : AuditSeverity.ERROR,
        resource: req.toolName,
        details: {
          requestId: req.context.requestId,
          injectionDetectedInOutput: result.injectionDetectedInOutput === true,
          error: result.error,
        },
      });
      return { decision, result };
    }
  }
}

function severityFor(action: DecisionAction): AuditSeverity {
  switch (action) {
    case DecisionAction.BLOCK:
      return AuditSeverity.WARN;
    case DecisionAction.REQUIRES_APPROVAL:
      return AuditSeverity.WARN;
    case DecisionAction.ALLOW:
    case DecisionAction.REDACT:
    case DecisionAction.REWRITE:
      return AuditSeverity.INFO;
  }
}
