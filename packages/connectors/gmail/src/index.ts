import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function getConfig(): GmailConfig {
  const cfg = {
    clientId: process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? '',
  };
  const missing: string[] = [];
  if (!cfg.clientId) missing.push('GMAIL_CLIENT_ID');
  if (!cfg.clientSecret) missing.push('GMAIL_CLIENT_SECRET');
  if (!cfg.refreshToken) missing.push('GMAIL_REFRESH_TOKEN');
  if (missing.length) throw new ConnectorNotConfiguredError('gmail', missing);
  return cfg;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  const cfg = getConfig();
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, { method: 'POST', body });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function buildRfc822(to: string, subject: string, body: string, from?: string): string {
  const lines = [
    from ? `From: ${from}` : null,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].filter(Boolean) as string[];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

const sendEmailTool: ConnectorTool = {
  metadata: defineTool('gmail.send_email', 'Send an email via Gmail (OAuth2 refresh-token flow)', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: {
      to: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' },
      from: { type: 'string' },
    },
    required: ['to', 'subject', 'body'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const token = await getAccessToken();
      const raw = buildRfc822(String(args['to']), String(args['subject']), String(args['body']), args['from'] as string | undefined);
      const res = await fetch(`${GMAIL_API}/messages/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        return { success: false, error: `Gmail send failed: ${res.status} ${await res.text()}` };
      }
      const j = await res.json();
      return { success: true, data: `Sent message id ${(j as { id?: string }).id ?? 'unknown'}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const listMessagesTool: ConnectorTool = {
  metadata: defineTool('gmail.list_messages', 'List recent Gmail messages', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: {
      query: { type: 'string', default: '' },
      maxResults: { type: 'number', default: 10 },
    },
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const token = await getAccessToken();
      const qs = new URLSearchParams({
        q: String(args['query'] ?? ''),
        maxResults: String(args['maxResults'] ?? 10),
      });
      const res = await fetch(`${GMAIL_API}/messages?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { success: false, error: `Gmail list failed: ${res.status}` };
      return { success: true, data: JSON.stringify(await res.json()) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const readEmailTool: ConnectorTool = {
  metadata: defineTool('gmail.read_email', 'Read a Gmail message by id', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${GMAIL_API}/messages/${encodeURIComponent(String(args['id']))}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { success: false, error: `Gmail read failed: ${res.status}` };
      return { success: true, data: JSON.stringify(await res.json()) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerGmailConnector(): void {
  registerConnectorTool(sendEmailTool);
  registerConnectorTool(listMessagesTool);
  registerConnectorTool(readEmailTool);
}
