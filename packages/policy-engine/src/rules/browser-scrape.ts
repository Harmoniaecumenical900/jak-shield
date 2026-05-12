import { RiskLevel } from '@jak-shield/shared';
import type { ToolCallRequest } from '@jak-shield/shared';
import { blockDecision } from '@jak-shield/core';
import type { PolicyRule } from './index.js';

const BLOCKED_HOSTS = (process.env.SHIELD_BROWSER_DENYLIST ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function isBrowserTool(toolName: string): boolean {
  const t = toolName.toLowerCase();
  return t.startsWith('browser.') || t.startsWith('http.') || t === 'fetch_url';
}

export const browserScrapeRule: PolicyRule = {
  name: 'browser-scrape',
  description: 'Block disallowed hosts and obviously malicious schemes for browser/http tools',
  evaluate(req) {
    if (!isBrowserTool(req.toolName)) return null;
    const args = (req.args ?? {}) as Record<string, unknown>;
    const url = (args['url'] ?? args['href'] ?? args['target']) as unknown;
    if (typeof url !== 'string') return null;

    if (/^(file|chrome|chrome-extension|view-source|javascript):/i.test(url)) {
      return blockDecision(
        `Disallowed URL scheme: ${url}`,
        'browser-scrape',
        RiskLevel.HIGH,
        'Use https:// or http:// URLs only.',
      );
    }

    let host = '';
    try {
      host = new URL(url).host.toLowerCase();
    } catch {
      return blockDecision(`Invalid URL: ${url}`, 'browser-scrape', RiskLevel.MEDIUM);
    }

    for (const blocked of BLOCKED_HOSTS) {
      if (host === blocked || host.endsWith(`.${blocked}`)) {
        return blockDecision(
          `Host on denylist: ${host}`,
          'browser-scrape',
          RiskLevel.HIGH,
        );
      }
    }
    return null;
  },
};
