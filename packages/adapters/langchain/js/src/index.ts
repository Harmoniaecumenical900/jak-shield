/**
 * JAK Shield ↔ LangChain.js adapter.
 *
 * Exports `JakShieldClient`, a set of `DynamicStructuredTool` instances for
 * use directly in a LangChain agent, and `gate(tool)` to wrap any existing
 * LangChain tool so its invocations are gated by JAK Shield.
 *
 * @example
 *   import { JakShieldClient, jakShieldTools, gate } from "@jak-shield/langchain";
 *   const shield = new JakShieldClient({ baseUrl, apiKey });
 *   const tools = jakShieldTools(shield);
 *   const safeSend = gate(myGmailTool, shield);
 */

import { DynamicStructuredTool, type StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export interface JakShieldClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface Decision {
  action: 'allow' | 'block' | 'requires_approval' | 'redact' | 'rewrite';
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  rule?: string | null;
  safe_alternative?: string | null;
  approval_id?: string | null;
  signature?: string;
  decision_id?: string;
  compliance?: string[];
  provenance?: {
    evidence: { source: string; weight: number; detail: string; confidence?: number; validators?: string[] }[];
    decidedBy: string;
    aggregateRiskScore: number;
    redactedArgs?: Record<string, unknown>;
  };
}

export class JakShieldClient {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(opts: JakShieldClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.JAK_SHIELD_URL ?? '').replace(/\/$/, '');
    if (!this.baseUrl) throw new Error('JAK_SHIELD_URL not set and baseUrl not provided');
    this.apiKey = opts.apiKey ?? process.env.JAK_SHIELD_API_KEY;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.fetcher = opts.fetchImpl ?? globalThis.fetch;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetcher(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body ?? {}),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`JAK Shield ${path} → ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetcher(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`JAK Shield ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  evaluate(tool_name: string, args: Record<string, unknown> = {}, context?: Record<string, string>): Promise<{ decision: Decision }> {
    return this.post('/evaluate', { tool_name, args, context });
  }

  scan(text: string): Promise<unknown> {
    return this.post('/evaluate/scan', { text });
  }

  redact(input: { text?: string; object?: Record<string, unknown> }): Promise<unknown> {
    return this.post('/evaluate/redact', input);
  }

  complianceTag(tool_name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.post('/evaluate/compliance-tag', { tool_name, args });
  }

  listTools(): Promise<unknown> {
    return this.get('/connectors/tools');
  }
}

// -------------------- Standalone LangChain tools ------------------------------

export function jakShieldTools(shield: JakShieldClient): DynamicStructuredTool[] {
  return [
    new DynamicStructuredTool({
      name: 'jak_shield_evaluate',
      description:
        'Evaluate a planned tool call against JAK Shield. Returns a decision with action ' +
        '(allow/block/requires_approval/redact/rewrite), risk, reason, evidence tree, ' +
        'and compliance tags. CALL THIS BEFORE running any tool that touches external systems.',
      schema: z.object({
        tool_name: z.string().describe('MCP tool name to evaluate (e.g. gmail.send_email)'),
        args: z.record(z.unknown()).default({}),
      }),
      func: async ({ tool_name, args }) => JSON.stringify(await shield.evaluate(tool_name, args)),
    }),
    new DynamicStructuredTool({
      name: 'jak_shield_scan',
      description:
        'Defense-in-depth scan: PII (28 types + checksums), secrets, prompt-injection across ' +
        '13 non-English languages and 6 detection stages. Returns evidence tree + redacted text.',
      schema: z.object({ text: z.string() }),
      func: async ({ text }) => JSON.stringify(await shield.scan(text)),
    }),
    new DynamicStructuredTool({
      name: 'jak_shield_redact',
      description:
        'Redact PII and secrets from a string or JSON object. Use BEFORE posting any ' +
        'potentially-sensitive payload to an external service.',
      schema: z.object({
        text: z.string().optional(),
        object: z.record(z.unknown()).optional(),
      }),
      func: async ({ text, object }) => JSON.stringify(await shield.redact({ text, object })),
    }),
    new DynamicStructuredTool({
      name: 'jak_shield_compliance_tag',
      description:
        'Tag a planned tool call with regulatory hints (PCI/HIPAA/GDPR/SOX/FERPA/DPDP/CCPA). ' +
        'These are TRIAGE SIGNALS — not legal compliance determinations. Surface the disclaimer.',
      schema: z.object({
        tool_name: z.string(),
        args: z.record(z.unknown()).default({}),
      }),
      func: async ({ tool_name, args }) => JSON.stringify(await shield.complianceTag(tool_name, args)),
    }),
  ];
}

// -------------------- Gate decorator ------------------------------------------

export function gate<T extends StructuredTool>(tool: T, shield: JakShieldClient): DynamicStructuredTool {
  // Wrap any LangChain tool. Every invocation evaluates first; block/approval
  // throws; redact substitutes args.
  return new DynamicStructuredTool({
    name: tool.name,
    description: `[JAK Shield-gated] ${tool.description}`,
    // Fall back to a permissive schema if the inner tool doesn't expose one.
    schema: (tool as unknown as { schema?: z.ZodTypeAny }).schema ?? z.record(z.unknown()),
    func: async (input: Record<string, unknown>) => {
      const { decision } = await shield.evaluate(tool.name, input);
      if (decision.action === 'block') {
        throw new Error(
          `JAK Shield blocked '${tool.name}': ${decision.reason}. ` +
            `Safe alternative: ${decision.safe_alternative ?? 'n/a'}`,
        );
      }
      if (decision.action === 'requires_approval') {
        throw new Error(
          `JAK Shield requires human approval (id=${decision.approval_id}): ${decision.reason}`,
        );
      }
      const effective =
        decision.action === 'redact' && decision.provenance?.redactedArgs
          ? decision.provenance.redactedArgs
          : input;
      return tool.invoke(effective as never);
    },
  });
}
