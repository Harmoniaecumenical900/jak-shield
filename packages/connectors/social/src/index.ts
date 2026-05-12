import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

interface DraftRecord {
  id: string;
  network: string;
  text: string;
  createdAt: string;
}

const drafts = new Map<string, DraftRecord>();
let counter = 0;

const createDraft: ConnectorTool = {
  metadata: defineTool('social.create_draft', 'Save a social post as a local draft (no external publish)', ToolRiskClass.WRITE, {
    type: 'object',
    properties: {
      network: { type: 'string', enum: ['twitter', 'linkedin', 'facebook', 'instagram'] },
      text: { type: 'string' },
    },
    required: ['network', 'text'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const id = `draft_${++counter}`;
    drafts.set(id, {
      id,
      network: String(args['network']),
      text: String(args['text']),
      createdAt: new Date().toISOString(),
    });
    return { success: true, data: `draft saved id=${id}` };
  },
};

const publishDraft: ConnectorTool = {
  metadata: defineTool('social.publish_with_approval', 'Publish a previously-created draft (always requires approval)', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const id = String(args['id']);
    const draft = drafts.get(id);
    if (!draft) return { success: false, error: `draft not found: ${id}` };
    // Stubbed publish: in production this would call Twitter/LinkedIn/Meta APIs.
    drafts.delete(id);
    return { success: true, data: `published draft ${id} to ${draft.network} (stub)` };
  },
};

const listDrafts: ConnectorTool = {
  metadata: defineTool('social.list_drafts', 'List pending social drafts', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: {},
  }),
  async execute(): Promise<ToolExecutionResult> {
    return { success: true, data: JSON.stringify([...drafts.values()]) };
  },
};

export function registerSocialConnector(): void {
  registerConnectorTool(createDraft);
  registerConnectorTool(publishDraft);
  registerConnectorTool(listDrafts);
}
