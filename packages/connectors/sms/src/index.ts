import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

interface TwilioCfg {
  sid: string;
  authToken: string;
  from: string;
}

function cfg(): TwilioCfg {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const from = process.env.TWILIO_FROM_NUMBER ?? '';
  const missing: string[] = [];
  if (!sid) missing.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
  if (!from) missing.push('TWILIO_FROM_NUMBER');
  if (missing.length) throw new ConnectorNotConfiguredError('sms', missing);
  return { sid, authToken, from };
}

const sendSms: ConnectorTool = {
  metadata: defineTool('sms.send', 'Send an SMS via Twilio', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: { to: { type: 'string' }, body: { type: 'string' } },
    required: ['to', 'body'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const c = cfg();
      const url = `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`;
      const auth = Buffer.from(`${c.sid}:${c.authToken}`).toString('base64');
      const body = new URLSearchParams({ To: String(args['to']), From: c.from, Body: String(args['body']) });
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) return { success: false, error: `Twilio error: ${res.status} ${await res.text()}` };
      const j = (await res.json()) as { sid?: string };
      return { success: true, data: `SMS sid=${j.sid}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerSmsConnector(): void {
  registerConnectorTool(sendSms);
}
