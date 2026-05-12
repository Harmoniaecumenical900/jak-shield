import { RISK_LEVEL_WEIGHTS, RiskLevel, ToolRiskClass } from '@jak-shield/shared';
import type { ToolMetadata } from '@jak-shield/shared';

export const TOOL_RISK_OVERRIDES: Partial<Record<string, ToolRiskClass>> = {
  // Email
  read_email: ToolRiskClass.READ_ONLY,
  list_emails: ToolRiskClass.READ_ONLY,
  search_email: ToolRiskClass.READ_ONLY,
  draft_email: ToolRiskClass.WRITE,
  create_draft: ToolRiskClass.WRITE,
  send_email: ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  send_draft: ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  // Gmail-prefixed
  'gmail.read_email': ToolRiskClass.READ_ONLY,
  'gmail.list_messages': ToolRiskClass.READ_ONLY,
  'gmail.send_email': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  // GitHub
  'github.create_issue': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  'github.create_pr_comment': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  'github.merge_pr': ToolRiskClass.DESTRUCTIVE,
  'github.delete_branch': ToolRiskClass.DESTRUCTIVE,
  // Database
  'supabase.query': ToolRiskClass.WRITE,
  'postgres.query': ToolRiskClass.WRITE,
  // Filesystem
  'filesystem.read': ToolRiskClass.READ_ONLY,
  'filesystem.write': ToolRiskClass.WRITE,
  'filesystem.delete': ToolRiskClass.DESTRUCTIVE,
  // Shell
  'shell.run': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  // Browser
  'browser.fetch': ToolRiskClass.READ_ONLY,
  'browser.click': ToolRiskClass.WRITE,
  'browser.submit': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  // Social
  'social.create_draft': ToolRiskClass.WRITE,
  'social.publish': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  'social.publish_with_approval': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  // Drive / Slack / SMS / Webhook
  'gdrive.read': ToolRiskClass.READ_ONLY,
  'gdrive.upload': ToolRiskClass.WRITE,
  'slack.send_message': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  'sms.send': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  'http.fetch': ToolRiskClass.READ_ONLY,
  'http.post': ToolRiskClass.EXTERNAL_SIDE_EFFECT,
  // Payment
  submit_payment: ToolRiskClass.DESTRUCTIVE,
  initiate_transfer: ToolRiskClass.DESTRUCTIVE,
  void_payment: ToolRiskClass.DESTRUCTIVE,
};

export function classifyToolRisk(toolName: string, metadata?: ToolMetadata): ToolRiskClass {
  const explicit = TOOL_RISK_OVERRIDES[toolName.toLowerCase()] ?? TOOL_RISK_OVERRIDES[toolName];
  if (explicit !== undefined) return explicit;
  if (metadata?.riskClass) return metadata.riskClass;

  const lower = toolName.toLowerCase();
  if (
    lower.includes('delete') ||
    lower.includes('destroy') ||
    lower.includes('purge') ||
    lower.includes('drop') ||
    lower.includes('payment') ||
    lower.includes('transfer') ||
    lower.includes('revoke')
  ) {
    return ToolRiskClass.DESTRUCTIVE;
  }
  if (
    lower.includes('send') ||
    lower.includes('submit') ||
    lower.includes('publish') ||
    lower.includes('webhook') ||
    lower.includes('notify')
  ) {
    return ToolRiskClass.EXTERNAL_SIDE_EFFECT;
  }
  if (
    lower.includes('create') ||
    lower.includes('update') ||
    lower.includes('write') ||
    lower.includes('set') ||
    lower.includes('add') ||
    lower.includes('insert') ||
    lower.includes('modify') ||
    lower.includes('edit') ||
    lower.includes('navigate') ||
    lower.includes('fill')
  ) {
    return ToolRiskClass.WRITE;
  }
  return ToolRiskClass.READ_ONLY;
}

export function toolRequiresApproval(toolName: string, threshold: RiskLevel, metadata?: ToolMetadata): boolean {
  if (metadata?.requiresApproval === true) return true;
  if (metadata?.requiresApproval === false) return false;

  const riskClass = classifyToolRisk(toolName, metadata);
  const riskClassToLevel: Record<ToolRiskClass, RiskLevel> = {
    [ToolRiskClass.READ_ONLY]: RiskLevel.LOW,
    [ToolRiskClass.WRITE]: RiskLevel.MEDIUM,
    [ToolRiskClass.EXTERNAL_SIDE_EFFECT]: RiskLevel.HIGH,
    [ToolRiskClass.DESTRUCTIVE]: RiskLevel.CRITICAL,
  };
  return RISK_LEVEL_WEIGHTS[riskClassToLevel[riskClass]] >= RISK_LEVEL_WEIGHTS[threshold];
}

export function describeRiskClass(riskClass: ToolRiskClass): string {
  switch (riskClass) {
    case ToolRiskClass.READ_ONLY:
      return 'Read-only operation — no data modification or external side effects';
    case ToolRiskClass.WRITE:
      return 'Write operation — modifies internal data or state';
    case ToolRiskClass.EXTERNAL_SIDE_EFFECT:
      return 'External side effect — sends data outside the system or triggers external actions';
    case ToolRiskClass.DESTRUCTIVE:
      return 'Destructive operation — permanently deletes data or executes irreversible financial transactions';
  }
}

export function classToRiskLevel(c: ToolRiskClass): RiskLevel {
  switch (c) {
    case ToolRiskClass.READ_ONLY:
      return RiskLevel.LOW;
    case ToolRiskClass.WRITE:
      return RiskLevel.MEDIUM;
    case ToolRiskClass.EXTERNAL_SIDE_EFFECT:
      return RiskLevel.HIGH;
    case ToolRiskClass.DESTRUCTIVE:
      return RiskLevel.CRITICAL;
  }
}
