import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

function getConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? '';
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_KEY');
  if (missing.length) throw new ConnectorNotConfiguredError('supabase', missing);
  return { url, serviceKey };
}

const queryTool: ConnectorTool = {
  metadata: defineTool('supabase.query', 'Execute a SQL query via the Supabase RPC `execute_sql` function (must exist on the project)', ToolRiskClass.WRITE, {
    type: 'object',
    properties: {
      sql: { type: 'string' },
    },
    required: ['sql'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const cfg = getConfig();
      const sql = String(args['sql'] ?? '');
      const res = await fetch(`${cfg.url}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.serviceKey,
          Authorization: `Bearer ${cfg.serviceKey}`,
        },
        body: JSON.stringify({ q: sql }),
      });
      if (!res.ok) return { success: false, error: `Supabase query failed: ${res.status} ${await res.text()}` };
      return { success: true, data: JSON.stringify(await res.json()) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const selectTool: ConnectorTool = {
  metadata: defineTool('supabase.select', 'Read rows via the PostgREST API', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: {
      table: { type: 'string' },
      columns: { type: 'string', default: '*' },
      filter: { type: 'string', description: 'PostgREST query string e.g. id=eq.1' },
      limit: { type: 'number', default: 100 },
    },
    required: ['table'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const cfg = getConfig();
      const table = String(args['table']);
      const cols = String(args['columns'] ?? '*');
      const filter = String(args['filter'] ?? '');
      const limit = Number(args['limit'] ?? 100);
      const qs = new URLSearchParams();
      qs.set('select', cols);
      if (filter) for (const part of filter.split('&')) {
        const [k, v] = part.split('=');
        if (k && v !== undefined) qs.append(k, v);
      }
      qs.set('limit', String(limit));
      const res = await fetch(`${cfg.url}/rest/v1/${encodeURIComponent(table)}?${qs.toString()}`, {
        headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` },
      });
      if (!res.ok) return { success: false, error: `Supabase select failed: ${res.status}` };
      return { success: true, data: JSON.stringify(await res.json()) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerSupabaseConnector(): void {
  registerConnectorTool(queryTool);
  registerConnectorTool(selectTool);
}
