import { DecisionAction, RiskLevel, RISK_LEVEL_WEIGHTS, ComplianceTag } from '@jak-shield/shared';
import type {
  ClassifierAdvice,
  PolicyDecision,
  ToolCallRequest,
  DecisionProvenance,
  Evidence,
} from '@jak-shield/shared';
import { allowDecision, approvalDecision, blockDecision, isHardBlock, redactDecision, signDecision } from '@jak-shield/core';
import { detectPIIDeep } from '@jak-shield/dlp';
import { detectInjectionV2, detectOffensiveCyberRequest } from '@jak-shield/prompt-shield';
import {
  anomalyCounter,
  chainCounter,
  decisionCounter,
  decisionLatency,
  injectionCounter,
  piiFindingCounter,
  taintCounter,
} from '@jak-shield/observability';
import { policyEngine } from './rbac.js';
import { classToRiskLevel, classifyToolRisk, toolRequiresApproval } from './risk-classifier.js';
import { ALL_RULES, type PolicyRule } from './rules/index.js';
import { evaluateAnomaly, recordCall } from './anomaly.js';
import { detectAttackChain, recordSessionCall } from './attack-chains.js';
import { checkArgsForTaint, isSensitiveSink } from './taint.js';
import { tagCompliance } from './compliance.js';

export interface DecideOptions {
  rules?: PolicyRule[];
  approvalThreshold?: RiskLevel;
  classifierAdvice?: ClassifierAdvice | null;
  skipInputScan?: boolean;
  /** Disable per-call tracking (used by tests). */
  noTracking?: boolean;
}

export function decide(req: ToolCallRequest, options: DecideOptions = {}): PolicyDecision {
  const t0 = Date.now();
  const out = decideInner(req, options);
  decisionLatency.observe(Date.now() - t0, { action: out.action });
  decisionCounter.inc({ action: out.action, rule: out.rule ?? 'none' });
  for (const e of out.provenance?.evidence ?? []) {
    if (e.source.startsWith('injection:')) injectionCounter.inc({ stage: e.source.replace('injection:', '') });
    if (e.source === 'pii-detector-v2') piiFindingCounter.inc({ type: (e.detail.split(' ')[0] ?? 'UNKNOWN') });
    if (e.source === 'taint-tracker') taintCounter.inc({ kind: 'untrusted-to-sensitive-sink' });
    if (e.source === 'anomaly-detector') anomalyCounter.inc({});
    if (e.source === 'attack-chain') chainCounter.inc({});
  }
  return out;
}

function decideInner(req: ToolCallRequest, options: DecideOptions = {}): PolicyDecision {
  const rules = options.rules ?? ALL_RULES;
  const approvalThreshold = options.approvalThreshold ?? RiskLevel.HIGH;
  const evidence: Evidence[] = [];
  let aggregateRisk = 0;

  if (!options.noTracking) {
    recordCall(req.context.tenantId, req.toolName, req.context.agentId);
    recordSessionCall(req.context.sessionId ?? req.context.requestId, req.toolName);
  }

  const finish = (d: PolicyDecision, decidedBy: string): PolicyDecision => {
    const prov: DecisionProvenance = {
      evidence: [...evidence],
      decidedBy,
      aggregateRiskScore: Math.min(1, aggregateRisk),
      classifier: options.classifierAdvice !== undefined
        ? { used: !!options.classifierAdvice, agreed: options.classifierAdvice?.suggestedAction === d.action, advice: options.classifierAdvice }
        : undefined,
    };
    return signDecision({ ...d, provenance: prov, decisionId: req.context.requestId, classifierAdvice: options.classifierAdvice ?? undefined });
  };

  // 1. Hard rules
  for (const rule of rules) {
    const decision = rule.evaluate(req);
    if (decision && isHardBlock(decision)) {
      evidence.push({ source: `rule:${rule.name}`, weight: 1.0, detail: decision.reason, validators: ['hard-rule'] });
      aggregateRisk = 1.0;
      const compliance = tagCompliance({ toolName: req.toolName, args: req.args });
      return finish({ ...decision, compliance }, `rule:${rule.name}`);
    }
  }

  // 2. Input injection + offensive
  if (!options.skipInputScan) {
    const argsObj = (req.args ?? {}) as Record<string, unknown>;
    const flatText = Object.values(argsObj).filter((v): v is string => typeof v === 'string').join('\n');

    const inj = detectInjectionV2(flatText);
    if (inj.detected) {
      for (const e of inj.evidence) {
        evidence.push({
          source: `injection:${e.stage}`,
          weight: e.risk === 'HIGH' ? 0.9 : 0.4,
          detail: e.pattern,
          validators: [e.stage],
          confidence: inj.confidence,
        });
      }
      aggregateRisk = Math.max(aggregateRisk, inj.confidence);
      if (inj.risk === 'HIGH') {
        const compliance = tagCompliance({ toolName: req.toolName, args: req.args });
        return finish(
          {
            ...blockDecision(
              `Prompt injection detected (${inj.evidence.length} signal${inj.evidence.length === 1 ? '' : 's'}): ${inj.evidence.slice(0, 3).map((e) => e.pattern).join('; ')}`,
              'prompt-injection-input',
              RiskLevel.HIGH,
              'Re-issue without quoted instructions, hidden HTML, base64-encoded payloads, or jailbreak phrasing.',
            ),
            compliance,
          },
          'injection-detector-v2',
        );
      }
    }

    const offensive = detectOffensiveCyberRequest(flatText);
    if (offensive.detected) {
      evidence.push({
        source: 'offensive-cyber',
        weight: offensive.confidence,
        detail: `category: ${offensive.category}`,
        validators: ['heuristic'],
        confidence: offensive.confidence,
      });
      aggregateRisk = Math.max(aggregateRisk, offensive.confidence);
      const compliance = tagCompliance({ toolName: req.toolName, args: req.args });
      return finish(
        {
          ...blockDecision(
            `Offensive cyber request detected (${offensive.category})`,
            'offensive-cyber',
            RiskLevel.CRITICAL,
            'Reframe as defensive security work (audit, hardening, IR) with explicit authorization.',
          ),
          compliance,
        },
        'offensive-cyber-detector',
      );
    }
  }

  // 3. Taint check
  if (!options.skipInputScan) {
    const taint = checkArgsForTaint(req.context.sessionId ?? req.context.requestId, (req.args ?? {}) as Record<string, unknown>);
    if (taint.tainted && isSensitiveSink(req.toolName)) {
      const untrusted = taint.records.find((r) => r.trust === 'UNTRUSTED');
      if (untrusted) {
        evidence.push({
          source: 'taint-tracker',
          weight: 0.85,
          detail: `Untrusted data from ${untrusted.source} reused as input to sensitive sink ${req.toolName}`,
          validators: ['taint-needle-match'],
          confidence: 0.95,
        });
        aggregateRisk = Math.max(aggregateRisk, 0.85);
        const compliance = tagCompliance({ toolName: req.toolName, args: req.args });
        return finish(
          {
            ...approvalDecision(
              `Tainted data from ${untrusted.source} (UNTRUSTED) is being sent through sensitive sink ${req.toolName}`,
              'taint-flow',
              RiskLevel.HIGH,
              'Sanitize or summarize the untrusted content before forwarding; do not pass scraped/browser output directly into outbound channels.',
            ),
            compliance,
          },
          'taint-tracker',
        );
      }
    }
  }

  // 4. Cross-call attack-chain
  const chain = detectAttackChain(
    req.context.sessionId ?? req.context.requestId,
    req.toolName,
    (req.args ?? {}) as Record<string, unknown>,
  );
  if (chain.matched) {
    evidence.push({
      source: 'attack-chain',
      weight: 0.9,
      detail: `${chain.matched.id}: ${chain.matched.description}`,
      validators: ['chain-pattern'],
      confidence: 0.9,
    });
    aggregateRisk = Math.max(aggregateRisk, 0.9);
    const compliance = tagCompliance({ toolName: req.toolName, args: req.args });
    return finish(
      {
        ...approvalDecision(
          `Detected attack pattern '${chain.matched.id}' — recent tools: ${chain.recentTools.slice(-4).join(' → ')} → ${req.toolName}`,
          'attack-chain',
          RiskLevel.HIGH,
          "Break the chain: avoid forwarding the prior tool's output directly into this call. Re-issue after manual review.",
        ),
        compliance,
      },
      'attack-chain',
    );
  }

  // 5. Soft rules
  for (const rule of rules) {
    const decision = rule.evaluate(req);
    if (decision) {
      evidence.push({
        source: `rule:${rule.name}`,
        weight: decision.action === DecisionAction.BLOCK ? 0.95 : 0.7,
        detail: decision.reason,
        validators: ['soft-rule'],
      });
      aggregateRisk = Math.max(aggregateRisk, decision.action === DecisionAction.BLOCK ? 0.95 : 0.7);
      const compliance = tagCompliance({ toolName: req.toolName, args: req.args });
      return finish({ ...decision, compliance }, `rule:${rule.name}`);
    }
  }

  // 6. PII scan
  let piiFindings: Awaited<ReturnType<typeof detectPIIDeep>>['findings'] = [];
  if (!options.skipInputScan) {
    const scan = detectPIIDeep((req.args ?? {}) as Record<string, unknown>);
    piiFindings = scan.findings;
    if (scan.findings.length > 0) {
      for (const f of scan.findings) {
        evidence.push({
          source: 'pii-detector-v2',
          weight: f.confidence,
          detail: `${f.type} in ${f.field ?? '(input)'}${f.contextHint ? ` (context: ${f.contextHint})` : ''}`,
          field: f.field,
          confidence: f.confidence,
          validators: f.validators,
        });
      }
      aggregateRisk = Math.max(aggregateRisk, Math.max(...scan.findings.map((f) => f.confidence)));
      const compliance = tagCompliance({ toolName: req.toolName, args: req.args, piiFindings: scan.findings });
      const piiDecision = redactDecision(
        scan.redacted,
        `PII redacted from input (${scan.findings.length} finding${scan.findings.length === 1 ? '' : 's'}: ${[...new Set(scan.findings.map((f) => f.type))].join(', ')})`,
        'dlp-input-redact',
      );
      return upgradeWithClassifier(
        { ...piiDecision, compliance },
        options.classifierAdvice,
        approvalThreshold,
        evidence,
        aggregateRisk,
        req,
      );
    }
  }

  // 7. Anomaly
  const riskClass = classifyToolRisk(req.toolName);
  const anomaly = evaluateAnomaly(req.context.tenantId, req.toolName, riskClass, req.context.agentId);
  if (anomaly.detected && anomaly.score >= 0.7) {
    evidence.push({
      source: 'anomaly-detector',
      weight: anomaly.score,
      detail: anomaly.reason,
      validators: ['baseline'],
      confidence: anomaly.score,
    });
    aggregateRisk = Math.max(aggregateRisk, anomaly.score);
    const compliance = tagCompliance({ toolName: req.toolName, args: req.args, piiFindings });
    const decision = approvalDecision(
      `Anomalous call pattern: ${anomaly.reason}`,
      'anomaly',
      RiskLevel.HIGH,
      'Confirm this burst is intentional; if not, pause the calling agent.',
    );
    const prov: DecisionProvenance = {
      evidence: [...evidence],
      decidedBy: 'anomaly-detector',
      aggregateRiskScore: aggregateRisk,
      anomaly: { detected: true, score: anomaly.score, baseline: anomaly.baseline, observed: anomaly.observed },
      classifier: options.classifierAdvice !== undefined
        ? { used: !!options.classifierAdvice, agreed: options.classifierAdvice?.suggestedAction === decision.action, advice: options.classifierAdvice }
        : undefined,
    };
    return signDecision({ ...decision, compliance, provenance: prov, decisionId: req.context.requestId, classifierAdvice: options.classifierAdvice ?? undefined });
  }

  // 8. RBAC
  if (!policyEngine.canExecuteTool(req.context.role, riskClass)) {
    evidence.push({
      source: 'rbac',
      weight: 1.0,
      detail: `Role ${req.context.role} cannot execute ${riskClass} tool`,
      validators: ['role-permission'],
    });
    aggregateRisk = Math.max(aggregateRisk, 1.0);
    const compliance = tagCompliance({ toolName: req.toolName, args: req.args, piiFindings });
    return finish(
      {
        ...blockDecision(
          `Role ${req.context.role} cannot execute ${riskClass} tool '${req.toolName}'`,
          'rbac-tool-execute',
          classToRiskLevel(riskClass),
        ),
        compliance,
      },
      'rbac',
    );
  }

  // 9. Threshold
  if (toolRequiresApproval(req.toolName, approvalThreshold)) {
    evidence.push({
      source: 'risk-threshold',
      weight: 0.6,
      detail: `${req.toolName} is ${riskClass}, exceeds threshold ${approvalThreshold}`,
      validators: ['risk-class'],
    });
    aggregateRisk = Math.max(aggregateRisk, 0.6);
    const compliance = tagCompliance({ toolName: req.toolName, args: req.args, piiFindings });
    return finish(
      {
        ...approvalDecision(
          `Tool '${req.toolName}' is ${riskClass} and exceeds approval threshold ${approvalThreshold}`,
          'risk-threshold',
          classToRiskLevel(riskClass),
        ),
        compliance,
      },
      'risk-threshold',
    );
  }

  // 10. Allow
  evidence.push({ source: 'allow', weight: 0, detail: `${riskClass} tool permitted under tenant policy`, validators: ['default-allow'] });
  const compliance = tagCompliance({ toolName: req.toolName, args: req.args, piiFindings });
  return upgradeWithClassifier(
    { ...allowDecision(`Tool '${req.toolName}' (${riskClass}) permitted under tenant policy`), compliance },
    options.classifierAdvice,
    approvalThreshold,
    evidence,
    aggregateRisk,
    req,
  );
}

function upgradeWithClassifier(
  base: PolicyDecision,
  advice: ClassifierAdvice | null | undefined,
  approvalThreshold: RiskLevel,
  evidence: Evidence[],
  aggregateRisk: number,
  req: ToolCallRequest,
): PolicyDecision {
  const finishIt = (d: PolicyDecision, decidedBy: string): PolicyDecision => {
    const prov: DecisionProvenance = {
      evidence: [...evidence],
      decidedBy,
      aggregateRiskScore: Math.min(1, aggregateRisk),
      classifier: advice !== undefined ? { used: !!advice, agreed: advice?.suggestedAction === d.action, advice } : undefined,
    };
    return signDecision({ ...d, provenance: prov, decisionId: req.context.requestId, classifierAdvice: advice ?? undefined });
  };
  if (!advice) return finishIt(base, base.rule ?? base.action);
  if (base.action === DecisionAction.BLOCK) return finishIt(base, base.rule ?? 'block');
  if (advice.risk >= 0.85 && advice.suggestedAction === DecisionAction.BLOCK) {
    evidence.push({ source: 'classifier', weight: advice.risk, detail: `escalate→block: ${advice.rationale}`, validators: ['openai'], confidence: advice.risk });
    aggregateRisk = Math.max(aggregateRisk, advice.risk);
    return finishIt(
      blockDecision(`Classifier flagged as high-risk: ${advice.rationale}`, 'classifier-escalation', RiskLevel.HIGH, advice.safeRewrite),
      'classifier-escalation',
    );
  }
  if (advice.risk >= 0.6 && base.action === DecisionAction.ALLOW) {
    evidence.push({ source: 'classifier', weight: advice.risk, detail: `escalate→approval: ${advice.rationale}`, validators: ['openai'], confidence: advice.risk });
    aggregateRisk = Math.max(aggregateRisk, advice.risk);
    return finishIt(
      approvalDecision(
        `Classifier flagged as risky (${(advice.risk * 100).toFixed(0)}%): ${advice.rationale}`,
        'classifier-escalation',
        RISK_LEVEL_WEIGHTS[approvalThreshold] >= RISK_LEVEL_WEIGHTS[RiskLevel.HIGH] ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        advice.safeRewrite,
      ),
      'classifier-escalation',
    );
  }
  return finishIt(base, base.rule ?? base.action);
}

export type { PolicyRule };
export { ALL_RULES, ComplianceTag };
