import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

function token(): string {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new ConnectorNotConfiguredError('slack', ['SLACK_BOT_TOKEN']);
  return t;
}

const sendMessage: ConnectorTool = {
  metadata: defineTool('slack.send_message', 'Post a message to a Slack channel', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: { channel: { type: 'string' }, text: { type: 'string' } },
    required: ['channel', 'text'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ channel: args['channel'], text: args['text'] }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; ts?: string };
      if (!j.ok) return { success: false, error: `Slack API error: ${j.error}` };
      return { success: true, data: `Posted ts=${j.ts}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerSlackConnector(): void {
  registerConnectorTool(sendMessage);
}
