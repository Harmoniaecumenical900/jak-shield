import { RiskLevel } from '@jak-shield/shared';
import type { ToolCallRequest } from '@jak-shield/shared';
import { approvalDecision } from '@jak-shield/core';
import { detectPII } from '@jak-shield/dlp';
import type { PolicyRule } from './index.js';

function corporateDomains(): string[] {
  return (process.env.SHIELD_CORPORATE_DOMAINS ?? 'jakshield.ai,jakswarm.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

const EMAIL_TOOLS = ['send_email', 'gmail.send_email', 'send_draft', 'mail.send'];

function isEmailTool(name: string): boolean {
  const lower = name.toLowerCase();
  return EMAIL_TOOLS.some((t) => lower === t || lower.endsWith(`_${t}`) || lower.endsWith(`.${t}`)) || (lower.includes('send') && lower.includes('email'));
}

function extractRecipients(args: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ['to', 'recipient', 'recipients', 'cc', 'bcc']) {
    const v = args[key];
    if (typeof v === 'string') out.push(...v.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
    else if (Array.isArray(v)) for (const item of v) if (typeof item === 'string') out.push(item.trim());
  }
  return out;
}

function isExternal(email: string): boolean {
  const at = email.indexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return !corporateDomains().some((d) => domain === d || domain.endsWith(`.${d}`));
}

function extractBody(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ['subject', 'body', 'message', 'text', 'html']) {
    const v = args[key];
    if (typeof v === 'string') parts.push(v);
  }
  return parts.join('\n');
}

export const externalEmailPiiRule: PolicyRule = {
  name: 'external-email-pii',
  description: 'Require approval when sending PII-bearing email to non-corporate domains',
  evaluate(req) {
    if (!isEmailTool(req.toolName)) return null;
    const args = (req.args ?? {}) as Record<string, unknown>;
    const recipients = extractRecipients(args);
    if (recipients.length === 0) return null;
    const externals = recipients.filter(isExternal);
    if (externals.length === 0) return null;

    const body = extractBody(args);
    const pii = detectPII(body);
    if (!pii.containsPII) return null;

    return approvalDecision(
      `External email to ${externals.join(', ')} contains ${pii.found.join(', ')}`,
      'external-email-pii',
      RiskLevel.HIGH,
      `Send an anonymized summary instead. PII types found: ${pii.found.join(', ')}.`,
    );
  },
};
