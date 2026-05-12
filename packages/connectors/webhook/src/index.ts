import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

const sendWebhook: ConnectorTool = {
  metadata: defineTool('webhook.send', 'POST a JSON payload to an outgoing webhook', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: { url: { type: 'string' }, payload: {} },
    required: ['url'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const res = await fetch(String(args['url']), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args['payload'] ?? {}),
      });
      return { success: res.ok, data: await res.text(), error: res.ok ? undefined : `${res.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerWebhookConnector(): void {
  registerConnectorTool(sendWebhook);
}
