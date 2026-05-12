import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

const TIMEOUT_MS = Number(process.env.SHIELD_HTTP_TIMEOUT_MS ?? 8_000);

const fetchTool: ConnectorTool = {
  metadata: defineTool('http.fetch', 'GET an arbitrary URL', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: { url: { type: 'string' }, headers: { type: 'object' } },
    required: ['url'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const url = String(args['url']);
    const headers = (args['headers'] ?? {}) as Record<string, string>;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      const text = await res.text();
      return { success: res.ok, data: text, error: res.ok ? undefined : `${res.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      clearTimeout(timer);
    }
  },
};

const postTool: ConnectorTool = {
  metadata: defineTool('http.post', 'POST a JSON body to a URL (external side effect)', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: { url: { type: 'string' }, body: {}, headers: { type: 'object' } },
    required: ['url'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const url = String(args['url']);
    const headers = { 'Content-Type': 'application/json', ...((args['headers'] ?? {}) as Record<string, string>) };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(args['body'] ?? {}), signal: ctrl.signal });
      const text = await res.text();
      return { success: res.ok, data: text, error: res.ok ? undefined : `${res.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      clearTimeout(timer);
    }
  },
};

export function registerHttpConnector(): void {
  registerConnectorTool(fetchTool);
  registerConnectorTool(postTool);
}
