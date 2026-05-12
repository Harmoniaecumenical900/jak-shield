import { RiskLevel } from '@jak-shield/shared';
import type { ToolCallRequest, PolicyDecision } from '@jak-shield/shared';
import { blockDecision } from '@jak-shield/core';
import type { PolicyRule } from './index.js';

const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\s+-rf\s+(?:\/|~|\$HOME|\*)/i, reason: 'rm -rf on root, home, or wildcards' },
  { pattern: /\bmkfs\b/i, reason: 'Filesystem format command' },
  { pattern: /\bdd\s+if=/i, reason: 'dd disk overwrite' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb' },
  { pattern: /\bchmod\s+-R\s+777\s+\//i, reason: 'Recursive 777 on root' },
  { pattern: /\bchown\s+-R\s+\w+\s+\//i, reason: 'Recursive chown on root' },
  { pattern: /\b(?:wget|curl)\s+[^|]*\|\s*(?:bash|sh|zsh|fish)\b/i, reason: 'Pipe download to shell' },
  { pattern: /\bshutdown\s+-h\b|\binit\s+0\b|\bpoweroff\b|\bhalt\b/i, reason: 'System shutdown' },
  { pattern: /\breboot\b/i, reason: 'System reboot' },
  { pattern: /\b(sudo\s+)?passwd\b/i, reason: 'Password change' },
  { pattern: /\biptables\s+-F\b/i, reason: 'Flush all firewall rules' },
  { pattern: /\bfdisk\s+\/dev\//i, reason: 'Partition table modification' },
  { pattern: /\bcrontab\s+-r\b/i, reason: 'Remove all cron jobs' },
  { pattern: /\b(useradd|userdel|adduser|deluser)\b/i, reason: 'User account management' },
  { pattern: /\bnc\s+-l\b/i, reason: 'Netcat listener (potential reverse shell)' },
  { pattern: /\b\/etc\/(passwd|shadow|sudoers)\b/i, reason: 'Sensitive system file access' },
];

const TARGET_FIELDS = ['command', 'cmd', 'script', 'shell', 'args'];

function extractCommand(req: ToolCallRequest): string {
  const args = req.args ?? {};
  for (const f of TARGET_FIELDS) {
    const v = (args as Record<string, unknown>)[f];
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.join(' ');
  }
  return JSON.stringify(args);
}

export const dangerousShellRule: PolicyRule = {
  name: 'dangerous-shell',
  description: 'Block destructive shell commands (rm -rf /, fork bomb, mkfs, etc.)',
  evaluate(req) {
    if (!req.toolName.toLowerCase().includes('shell') && !req.toolName.toLowerCase().includes('exec') && !req.toolName.toLowerCase().includes('run')) {
      return null;
    }
    const cmd = extractCommand(req);
    for (const { pattern, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(cmd)) {
        return blockDecision(
          `Shell command blocked: ${reason}`,
          'dangerous-shell',
          RiskLevel.CRITICAL,
          'Run a less-destructive equivalent or request admin approval through the dashboard.',
        );
      }
    }
    return null;
  },
};

export function isDangerousShell(cmd: string): { dangerous: boolean; reason?: string } {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(cmd)) return { dangerous: true, reason };
  }
  return { dangerous: false };
}

export type _Decision = PolicyDecision;
