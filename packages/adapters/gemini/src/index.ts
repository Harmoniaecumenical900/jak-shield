/**
 * JAK Shield ↔ Google Gemini adapter.
 *
 * Exports:
 *   - `JAK_SHIELD_FUNCTION_DECLARATIONS` — array of FunctionDeclarations to pass
 *     to a Gemini model (in `tools: [{ functionDeclarations }]`)
 *   - `JakShieldGeminiClient` — REST client for Shield
 *   - `handleFunctionCall(call, client)` — dispatch a Gemini-emitted function
 *     call to JAK Shield and return a Gemini-shaped FunctionResponse
 *
 * Compatible with @google/genai (the official "GenAI SDK"). The function-
 * declaration shape is intentionally model-agnostic — it also works with
 * @google/generative-ai, Vertex AI, and any client that consumes Gemini-spec
 * function declarations.
 */

// ---- Gemini-shaped types (subset, not depending on the SDK package) ---------

export type GeminiType =
  | 'STRING'
  | 'NUMBER'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'OBJECT'
  | 'ARRAY';

export interface GeminiSchema {
  type: GeminiType;
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: GeminiSchema;
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiFunctionResponse {
  name: string;
  response: { content: unknown };
}

// ---- Function declarations --------------------------------------------------

export const JAK_SHIELD_FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'jak_shield_evaluate',
    description:
      'Evaluate a planned tool call against JAK Shield. Returns a decision ' +
      '(allow / block / requires_approval / redact / rewrite) with full ' +
      'evidence tree, HMAC signature, and compliance hints. CALL THIS ' +
      'BEFORE running any tool that touches external systems, PII, ' +
      'databases, or shell commands.',
    parameters: {
      type: 'OBJECT',
      required: ['tool_name'],
      properties: {
        tool_name: {
          type: 'STRING',
          description: 'The MCP tool name (e.g. gmail.send_email, postgres.query)',
        },
        args: {
          type: 'OBJECT',
          description: 'Args the agent intends to pass to the tool',
        },
      },
    },
  },
  {
    name: 'jak_shield_scan',
    description:
      'Defense-in-depth scan of a string for PII (28 types with checksum ' +
      'validators), secrets, and prompt-injection across 13 non-English ' +
      'languages and 6 detection stages. Returns evidence tree, redacted ' +
      'text, and per-finding confidence.',
    parameters: {
      type: 'OBJECT',
      required: ['text'],
      properties: {
        text: { type: 'STRING', description: 'String to scan' },
      },
    },
  },
  {
    name: 'jak_shield_redact',
    description:
      'Redact PII and secrets from a string or JSON object. Use BEFORE ' +
      'posting any potentially-sensitive payload to an external service.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Text to redact (pass either text OR object)' },
        object: { type: 'OBJECT', description: 'JSON to walk recursively (pass either text OR object)' },
      },
    },
  },
  {
    name: 'jak_shield_compliance_tag',
    description:
      'Tag a planned tool call with regulatory hints (PCI / HIPAA / GDPR / ' +
      'CCPA / SOX / FERPA / DPDP). These are TRIAGE SIGNALS — not legal ' +
      'compliance determinations. Always surface the returned disclaimer.',
    parameters: {
      type: 'OBJECT',
      required: ['tool_name'],
      properties: {
        tool_name: { type: 'STRING' },
        args: { type: 'OBJECT' },
      },
    },
  },
];

// ---- Client -----------------------------------------------------------------

export interface JakShieldGeminiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class JakShieldGeminiClient {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(opts: JakShieldGeminiClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.JAK_SHIELD_URL ?? '').replace(/\/$/, '');
    if (!this.baseUrl) throw new Error('JAK_SHIELD_URL not set and baseUrl not provided');
    this.apiKey = opts.apiKey ?? process.env.JAK_SHIELD_API_KEY;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.fetcher = opts.fetchImpl ?? globalThis.fetch;
  }

  private async call(path: string, body: unknown): Promise<unknown> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
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
      return res.json();
    } finally {
      clearTimeout(t);
    }
  }
}

// ---- Function-call dispatcher -----------------------------------------------

/**
 * Dispatch a Gemini-emitted FunctionCall to JAK Shield and return the
 * Gemini-shaped FunctionResponse you should send back to the model.
 *
 * Usage with @google/genai:
 *
 *   const result = await model.generateContent({ ... });
 *   const call = result.response.functionCalls?.[0];
 *   if (call) {
 *     const fnResp = await handleFunctionCall(call, client);
 *     // send fnResp back to the model in the next turn
 *   }
 */
export async function handleFunctionCall(
  call: GeminiFunctionCall,
  client: JakShieldGeminiClient,
): Promise<GeminiFunctionResponse> {
  const args = call.args ?? {};
  let path: string;
  let body: unknown;

  switch (call.name) {
    case 'jak_shield_evaluate':
      path = '/evaluate';
      body = { tool_name: args.tool_name, args: args.args ?? {} };
      break;
    case 'jak_shield_scan':
      path = '/evaluate/scan';
      body = { text: args.text };
      break;
    case 'jak_shield_redact':
      path = '/evaluate/redact';
      body = { text: args.text, object: args.object };
      break;
    case 'jak_shield_compliance_tag':
      path = '/evaluate/compliance-tag';
      body = { tool_name: args.tool_name, args: args.args ?? {} };
      break;
    default:
      return {
        name: call.name,
        response: { content: { error: `Unknown JAK Shield function: ${call.name}` } },
      };
  }

  // Reach into the private call() — we're in the same module.
  const result = await (client as unknown as { call: (p: string, b: unknown) => Promise<unknown> }).call(path, body);
  return { name: call.name, response: { content: result } };
}

// ---- Gate helper ------------------------------------------------------------

export interface ToolHandler {
  name: string;
  description: string;
  invoke: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

/**
 * Wrap one of your own tool handlers so its invocations are evaluated by
 * JAK Shield first. Returns a new handler with the same shape.
 */
export function gate(tool: ToolHandler, client: JakShieldGeminiClient): ToolHandler {
  return {
    name: tool.name,
    description: `[JAK Shield-gated] ${tool.description}`,
    invoke: async (args) => {
      const result = (await (client as unknown as { call: (p: string, b: unknown) => Promise<{ decision: { action: string; reason: string; safe_alternative?: string; approval_id?: string; provenance?: { redactedArgs?: Record<string, unknown> } } }> }).call('/evaluate', {
        tool_name: tool.name,
        args,
      })) as {
        decision: {
          action: string;
          reason: string;
          safe_alternative?: string;
          approval_id?: string;
          provenance?: { redactedArgs?: Record<string, unknown> };
        };
      };
      const d = result.decision;
      if (d.action === 'block') {
        throw new Error(`JAK Shield blocked '${tool.name}': ${d.reason}. Safe alternative: ${d.safe_alternative ?? 'n/a'}`);
      }
      if (d.action === 'requires_approval') {
        throw new Error(`JAK Shield requires human approval (id=${d.approval_id}): ${d.reason}`);
      }
      const effective = d.action === 'redact' && d.provenance?.redactedArgs ? d.provenance.redactedArgs : args;
      return tool.invoke(effective);
    },
  };
}
