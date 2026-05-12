import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';
import { detectInjection } from '@jak-shield/prompt-shield';

const TIMEOUT_MS = Number(process.env.SHIELD_BROWSER_TIMEOUT_MS ?? 8_000);
const MAX_BYTES = Number(process.env.SHIELD_BROWSER_MAX_BYTES ?? 200_000);

const fetchTool: ConnectorTool = {
  metadata: defineTool('browser.fetch', 'Fetch a URL and return the response body (HTML/text). Output is scanned for injection.', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: {
      url: { type: 'string' },
      headers: { type: 'object' },
    },
    required: ['url'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const url = String(args['url'] ?? '');
    const headers = (args['headers'] ?? {}) as Record<string, string>;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      const buf = await res.arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf.slice(0, MAX_BYTES)));
      const inj = detectInjection(text, true);
      return {
        success: res.ok,
        data: text,
        injectionDetectedInOutput: inj.detected,
        error: res.ok ? undefined : `${res.status} ${res.statusText}`,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      clearTimeout(timer);
    }
  },
};

export function registerBrowserConnector(): void {
  registerConnectorTool(fetchTool);
}
