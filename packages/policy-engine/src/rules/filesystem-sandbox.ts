import { RiskLevel } from '@jak-shield/shared';
import type { ToolCallRequest } from '@jak-shield/shared';
import { approvalDecision, blockDecision } from '@jak-shield/core';
import * as path from 'node:path';
import type { PolicyRule } from './index.js';

const SANDBOX_ROOT = process.env.SHIELD_FS_SANDBOX_ROOT
  ? path.resolve(process.env.SHIELD_FS_SANDBOX_ROOT)
  : path.resolve(process.cwd(), '.shield-sandbox');

const FORBIDDEN_PATHS = [
  /^\/etc\//i,
  /^\/var\/log\//i,
  /^\/root\//i,
  /^\/sys\//i,
  /^\/proc\//i,
  /^[A-Z]:\\Windows\\System32\\/i,
  /\.ssh[\/\\]/i,
  /\.aws[\/\\]credentials/i,
  /\.git[\/\\]config/i,
];

function extractPath(req: ToolCallRequest): string | null {
  const args = (req.args ?? {}) as Record<string, unknown>;
  for (const f of ['path', 'file', 'filepath', 'filename']) {
    const v = args[f];
    if (typeof v === 'string') return v;
  }
  return null;
}

function isFsTool(toolName: string): boolean {
  const t = toolName.toLowerCase();
  return t.startsWith('filesystem.') || t.startsWith('fs.') || t.includes('file_') || t === 'read_file' || t === 'write_file' || t === 'delete_file';
}

function isInsideSandbox(target: string): boolean {
  // Relative paths are interpreted by the connector as relative to the sandbox
  // root, so they're inherently inside. Only validate absolute paths.
  if (!path.isAbsolute(target)) return true;
  const rel = path.relative(SANDBOX_ROOT, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export const filesystemSandboxRule: PolicyRule = {
  name: 'filesystem-sandbox',
  description: 'Restrict filesystem ops to the sandbox root and block sensitive paths',
  evaluate(req) {
    if (!isFsTool(req.toolName)) return null;
    const p = extractPath(req);
    if (!p) return null;

    for (const pattern of FORBIDDEN_PATHS) {
      if (pattern.test(p)) {
        return blockDecision(
          `Filesystem path is forbidden: ${p}`,
          'filesystem-sandbox',
          RiskLevel.CRITICAL,
          `Read/write only inside the sandbox root: ${SANDBOX_ROOT}`,
        );
      }
    }
    if (!isInsideSandbox(p)) {
      return approvalDecision(
        `Filesystem path is outside the sandbox: ${p}`,
        'filesystem-sandbox',
        RiskLevel.HIGH,
        `Move the file under ${SANDBOX_ROOT} or request admin approval.`,
      );
    }
    return null;
  },
};

export function getSandboxRoot(): string {
  return SANDBOX_ROOT;
}
