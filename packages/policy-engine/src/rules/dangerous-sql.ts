import { RiskLevel } from '@jak-shield/shared';
import type { ToolCallRequest } from '@jak-shield/shared';
import { approvalDecision, blockDecision } from '@jak-shield/core';
import type { PolicyRule } from './index.js';

const HARD_BLOCK: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bdrop\s+(?:table|database|schema|user|role|index)\b/i, reason: 'DROP statement' },
  { pattern: /\btruncate\s+(?:table\s+)?\w+/i, reason: 'TRUNCATE statement' },
  { pattern: /\balter\s+user\s+\w+\s+(?:with\s+)?(?:password|superuser)/i, reason: 'ALTER USER privilege change' },
  { pattern: /\bgrant\s+all\s+privileges\b/i, reason: 'GRANT ALL PRIVILEGES' },
  { pattern: /\brevoke\s+all\b/i, reason: 'REVOKE ALL' },
];

const APPROVAL_REQUIRED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bdelete\s+from\s+\w+\s*(?!.*\bwhere\b)/is, reason: 'DELETE without WHERE clause' },
  { pattern: /\bupdate\s+\w+\s+set\s+.+(?!.*\bwhere\b)/is, reason: 'UPDATE without WHERE clause' },
  { pattern: /\bcreate\s+(?:user|role)\b/i, reason: 'CREATE USER/ROLE' },
];

const TARGET_FIELDS = ['sql', 'query', 'statement', 'q'];

function extractSql(req: ToolCallRequest): string {
  const args = req.args ?? {};
  for (const f of TARGET_FIELDS) {
    const v = (args as Record<string, unknown>)[f];
    if (typeof v === 'string') return v;
  }
  return '';
}

function isSqlTool(toolName: string): boolean {
  const t = toolName.toLowerCase();
  return t.includes('sql') || t.includes('query') || t.includes('postgres') || t.includes('supabase') || t.includes('database') || t.includes('mysql') || t.includes('sqlite');
}

export const dangerousSqlRule: PolicyRule = {
  name: 'dangerous-sql',
  description: 'Block destructive DDL (DROP/TRUNCATE/ALTER USER) and require approval for unsafe DML',
  evaluate(req) {
    if (!isSqlTool(req.toolName)) return null;
    const sql = extractSql(req);
    if (!sql) return null;

    for (const { pattern, reason } of HARD_BLOCK) {
      if (pattern.test(sql)) {
        return blockDecision(
          `SQL blocked: ${reason}`,
          'dangerous-sql',
          RiskLevel.CRITICAL,
          'Use a migration tool with admin approval, or scope the change with a WHERE clause.',
        );
      }
    }
    for (const { pattern, reason } of APPROVAL_REQUIRED) {
      if (pattern.test(sql)) {
        return approvalDecision(
          `SQL needs admin approval: ${reason}`,
          'dangerous-sql',
          RiskLevel.HIGH,
          'Add a WHERE clause to scope the change.',
        );
      }
    }
    return null;
  },
};
