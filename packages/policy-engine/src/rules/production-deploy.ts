import { RiskLevel } from '@jak-shield/shared';
import type { ToolCallRequest } from '@jak-shield/shared';
import { approvalDecision } from '@jak-shield/core';
import type { PolicyRule } from './index.js';

const DEPLOY_TOOL_HINTS = ['deploy', 'release', 'rollout', 'publish', 'merge_pr', 'production', 'prod'];

function looksLikeDeploy(toolName: string, args: Record<string, unknown>): boolean {
  const lower = toolName.toLowerCase();
  if (DEPLOY_TOOL_HINTS.some((h) => lower.includes(h))) return true;
  const env = (args['environment'] ?? args['env'] ?? args['target']) as unknown;
  if (typeof env === 'string' && /\b(prod|production|live)\b/i.test(env)) return true;
  return false;
}

export const productionDeployRule: PolicyRule = {
  name: 'production-deploy',
  description: 'Require approval for any production deployment / release',
  evaluate(req) {
    const args = (req.args ?? {}) as Record<string, unknown>;
    if (!looksLikeDeploy(req.toolName, args)) return null;

    const env = (args['environment'] ?? args['env'] ?? args['target']) as unknown;
    const isProd = typeof env === 'string' && /\b(prod|production|live)\b/i.test(env);

    if (isProd || /production|prod\b|live/i.test(req.toolName.toLowerCase())) {
      return approvalDecision(
        `Production deployment requires admin approval (${req.toolName})`,
        'production-deploy',
        RiskLevel.CRITICAL,
        'Stage to a non-prod environment first; capture rollback plan.',
      );
    }
    return null;
  },
};
