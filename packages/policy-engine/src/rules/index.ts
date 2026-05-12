import type { ToolCallRequest, PolicyDecision } from '@jak-shield/shared';
import { dangerousShellRule } from './dangerous-shell.js';
import { dangerousSqlRule } from './dangerous-sql.js';
import { externalEmailPiiRule } from './external-email-pii.js';
import { productionDeployRule } from './production-deploy.js';
import { paymentRule } from './payment.js';
import { socialPublishRule } from './social-publish.js';
import { filesystemSandboxRule, getSandboxRoot } from './filesystem-sandbox.js';
import { browserScrapeRule } from './browser-scrape.js';

export interface PolicyRule {
  name: string;
  description: string;
  evaluate(req: ToolCallRequest): PolicyDecision | null;
}

export const ALL_RULES: PolicyRule[] = [
  dangerousShellRule,
  dangerousSqlRule,
  externalEmailPiiRule,
  productionDeployRule,
  paymentRule,
  socialPublishRule,
  filesystemSandboxRule,
  browserScrapeRule,
];

export {
  dangerousShellRule,
  dangerousSqlRule,
  externalEmailPiiRule,
  productionDeployRule,
  paymentRule,
  socialPublishRule,
  filesystemSandboxRule,
  browserScrapeRule,
  getSandboxRoot,
};
