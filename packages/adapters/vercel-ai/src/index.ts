/**
 * JAK Shield ↔ Vercel AI SDK adapter.
 *
 * Exports `jakShieldTools(client)` returning a map of `tool()`-compatible
 * Vercel AI SDK tools, plus a `gate()` wrapper that lets you wrap any
 * existing Vercel AI tool so its invocations are evaluated by JAK Shield
 * first.
 *
 * Compatible with Vercel AI SDK v4+ (the `ai` package). Works in:
 *   - Next.js API routes / server components
 *   - Edge runtime
 *   - Node.js
 *   - Cloudflare Workers (pass a `fetchImpl`)
 *
 * @example
 *   import { generateText, type Tool } from 'ai';
 *   import { openai } from '@ai-sdk/openai';
 *   import { JakShieldClient, jakShieldTools, gate } from '@jak-shield/vercel-ai';
 *
 *   const shield = new JakShieldClient({ baseUrl, apiKey });
 *
 *   const { text } = await generateText({
 *     model: openai('gpt-4o-mini'),
 *     tools: { ...jakShieldTools(shield), my_email: gate(myEmailTool, shield) },
 *     prompt: 'Should I send the customer roster to partner@external.com?',
 *   });
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';

// -------------------- Client ------------------------------------------------

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

  private async post<T>(path: string, body: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
      const res = await this.fetcher(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`JAK Shield ${path} → ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  evaluate(tool_name: string, args: Record<string, unknown> = {}): Promise<{ decision: Decision }> {
    return this.post('/evaluate', { tool_name, args });
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
}

// -------------------- Tools --------------------------------------------------

export function jakShieldTools(shield: JakShieldClient): Record<string, Tool> {
  return {
    jak_shield_evaluate: tool({
      description:
        'Evaluate a planned tool call against JAK Shield. Returns a decision ' +
        '(allow / block / requires_approval / redact / rewrite) with full ' +
        'evidence tree, HMAC signature, and compliance hints. CALL THIS ' +
        'BEFORE running any tool that touches external systems, PII, ' +
        'databases, or shell commands.',
      parameters: z.object({
        tool_name: z.string().describe('MCP tool name (e.g. gmail.send_email)'),
        args: z.record(z.unknown()).default({}),
      }),
      execute: async ({ tool_name, args }) => shield.evaluate(tool_name, args),
    }),

    jak_shield_scan: tool({
      description:
        'Defense-in-depth scan of a string for PII (28 types with cryptographic ' +
        'validators), secrets, and prompt injection across 13 non-English ' +
        'languages and 6 detection stages.',
      parameters: z.object({ text: z.string() }),
      execute: async ({ text }) => shield.scan(text),
    }),

    jak_shield_redact: tool({
      description:
        'Redact PII and secrets from a string or JSON object. Use BEFORE ' +
        'posting any potentially-sensitive payload to an external service.',
      parameters: z.object({
        text: z.string().optional(),
        object: z.record(z.unknown()).optional(),
      }),
      execute: async ({ text, object }) => shield.redact({ text, object }),
    }),

    jak_shield_compliance_tag: tool({
      description:
        'Tag a planned tool call with regulatory hints (PCI / HIPAA / GDPR / ' +
        'CCPA / SOX / FERPA / DPDP). These are TRIAGE SIGNALS — not legal ' +
        'compliance determinations. Always surface the returned disclaimer.',
      parameters: z.object({
        tool_name: z.string(),
        args: z.record(z.unknown()).default({}),
      }),
      execute: async ({ tool_name, args }) => shield.complianceTag(tool_name, args),
    }),
  };
}

// -------------------- gate() wrapper -----------------------------------------

/**
 * Wrap an existing Vercel AI SDK tool so every invocation is evaluated by
 * JAK Shield first. If the decision is `block` or `requires_approval`, the
 * wrapped tool throws. If `redact`, the tool runs with redacted args.
 */
// `Tool` from `ai` is generic over its parameters + result; we keep it broad here.
type AnyTool = Tool<z.ZodTypeAny, unknown>;

export function gate<T extends AnyTool>(
  inner: T,
  shield: JakShieldClient,
  toolName: string,
): AnyTool {
  return tool({
    description: `[JAK Shield-gated] ${inner.description ?? ''}`,
    parameters: inner.parameters,
    execute: async (args: Record<string, unknown>, opts) => {
      const { decision } = await shield.evaluate(toolName, args);
      if (decision.action === 'block') {
        throw new Error(
          `JAK Shield blocked '${toolName}': ${decision.reason}. ` +
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
          : args;
      if (typeof inner.execute !== 'function') {
        throw new Error(`Inner tool '${toolName}' has no execute()`);
      }
      return inner.execute(effective as never, opts);
    },
  });
}
