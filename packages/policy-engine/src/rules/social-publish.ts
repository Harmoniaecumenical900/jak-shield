import { RiskLevel } from '@jak-shield/shared';
import { approvalDecision } from '@jak-shield/core';
import type { PolicyRule } from './index.js';

const PUBLISH_HINTS = ['social.publish', 'twitter.post', 'linkedin.post', 'facebook.post', 'instagram.post', 'social_post'];

export const socialPublishRule: PolicyRule = {
  name: 'social-publish',
  description: 'Require approval before posting to public social channels',
  evaluate(req) {
    const lower = req.toolName.toLowerCase();
    if (!PUBLISH_HINTS.some((h) => lower.includes(h))) return null;
    if (lower.includes('draft')) return null;
    return approvalDecision(
      `Social publish requires approval: ${req.toolName}`,
      'social-publish',
      RiskLevel.HIGH,
      'Save as draft first; review the post copy and any embedded links in the dashboard.',
    );
  },
};
