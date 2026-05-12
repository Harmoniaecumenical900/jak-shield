import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ToolRiskClass } from '@jak-shield/shared';
import type { PolicyDecision, ToolCallContext, ToolExecutionResult } from '@jak-shield/shared';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';
import { getSandboxRoot } from '@jak-shield/policy-engine';

function safePath(p: string): string {
  const root = getSandboxRoot();
  const resolved = path.resolve(root, p.replace(/^[\/\\]+/, ''));
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`filesystem: refusing to access path outside sandbox: ${p}`);
  }
  return resolved;
}

const readTool: ConnectorTool = {
  metadata: defineTool('filesystem.read', 'Read a file inside the JAK Shield sandbox', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path relative to the sandbox root' },
    },
    required: ['path'],
  }),
  async execute(args, _ctx: ToolCallContext, _decision: PolicyDecision): Promise<ToolExecutionResult> {
    const p = String(args['path'] ?? '');
    try {
      const file = safePath(p);
      const data = await fs.readFile(file, 'utf-8');
      return { success: true, data };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const writeTool: ConnectorTool = {
  metadata: defineTool('filesystem.write', 'Write a file inside the JAK Shield sandbox', ToolRiskClass.WRITE, {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const p = String(args['path'] ?? '');
    const content = String(args['content'] ?? '');
    try {
      const file = safePath(p);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content, 'utf-8');
      return { success: true, data: `wrote ${content.length} bytes to ${p}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const deleteTool: ConnectorTool = {
  metadata: defineTool('filesystem.delete', 'Delete a file inside the JAK Shield sandbox', ToolRiskClass.DESTRUCTIVE, {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const p = String(args['path'] ?? '');
    try {
      const file = safePath(p);
      await fs.unlink(file);
      return { success: true, data: `deleted ${p}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const listTool: ConnectorTool = {
  metadata: defineTool('filesystem.list', 'List files in a sandbox directory', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: { path: { type: 'string', default: '.' } },
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const p = String(args['path'] ?? '.');
    try {
      const dir = safePath(p);
      const entries = await fs.readdir(dir);
      return { success: true, data: entries.join('\n') };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerFilesystemConnector(): void {
  registerConnectorTool(readTool);
  registerConnectorTool(writeTool);
  registerConnectorTool(deleteTool);
  registerConnectorTool(listTool);
}
