import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

const exec = promisify(execFile);

const ALLOWLIST = (process.env.SHIELD_SHELL_ALLOWLIST ?? 'echo,ls,cat,pwd,whoami,hostname,date,uptime,df,du,uname')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TIMEOUT_MS = Number(process.env.SHIELD_SHELL_TIMEOUT_MS ?? 10_000);

const runTool: ConnectorTool = {
  metadata: defineTool('shell.run', 'Run an allowlisted shell command (no shell metacharacters; argv style only)', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Program name (must be on the allowlist)' },
      args: { type: 'array', items: { type: 'string' } },
    },
    required: ['command'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    const cmd = String(args['command'] ?? '');
    const argv = Array.isArray(args['args']) ? (args['args'] as unknown[]).map((a) => String(a)) : [];

    if (!ALLOWLIST.includes(cmd)) {
      return { success: false, error: `Command '${cmd}' is not on the allowlist (${ALLOWLIST.join(', ')})` };
    }
    if (argv.some((a) => /[;&|`$<>]/.test(a))) {
      return { success: false, error: 'Argument contains shell metacharacters; refusing to run' };
    }

    try {
      const { stdout, stderr } = await exec(cmd, argv, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 });
      return { success: true, data: stderr ? `${stdout}\n--stderr--\n${stderr}` : stdout };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerShellConnector(): void {
  registerConnectorTool(runTool);
}
