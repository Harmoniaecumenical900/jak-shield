import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

interface GDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function getConfig(): GDriveConfig {
  const cfg = {
    clientId: process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
    refreshToken: process.env.GDRIVE_REFRESH_TOKEN ?? process.env.GMAIL_REFRESH_TOKEN ?? '',
  };
  const missing: string[] = [];
  if (!cfg.clientId) missing.push('GMAIL_CLIENT_ID');
  if (!cfg.clientSecret) missing.push('GMAIL_CLIENT_SECRET');
  if (!cfg.refreshToken) missing.push('GDRIVE_REFRESH_TOKEN');
  if (missing.length) throw new ConnectorNotConfiguredError('gdrive', missing);
  return cfg;
}

let token: { value: string; expiresAt: number } | null = null;
async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const c = getConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`gdrive token refresh failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return token.value;
}

const listTool: ConnectorTool = {
  metadata: defineTool('gdrive.list', 'List files on Google Drive', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: { q: { type: 'string' }, pageSize: { type: 'number', default: 20 } },
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const t = await getToken();
      const qs = new URLSearchParams({ pageSize: String(args['pageSize'] ?? 20) });
      if (args['q']) qs.set('q', String(args['q']));
      const res = await fetch(`${DRIVE_API}/files?${qs}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) return { success: false, error: `gdrive list failed: ${res.status}` };
      return { success: true, data: JSON.stringify(await res.json()) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerGDriveConnector(): void {
  registerConnectorTool(listTool);
}
