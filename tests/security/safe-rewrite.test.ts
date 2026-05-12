import { describe, expect, test } from 'vitest';
import { decide } from '@jak-shield/policy-engine';
import { DecisionAction, RiskLevel } from '@jak-shield/shared';
import { req } from './helpers.js';

describe('safe-rewrite', () => {
  test('classifier suggesting BLOCK escalates the decision', () => {
    const r = req('http.fetch', { url: 'https://example.com' });
    const d = decide(r, {
      classifierAdvice: {
        risk: 0.95,
        intentClass: 'exfiltration',
        suggestedAction: DecisionAction.BLOCK,
        rationale: 'classifier judged this an exfil attempt',
        safeRewrite: 'use the http.head endpoint instead',
        source: 'openai',
        latencyMs: 200,
      },
    });
    expect(d.action).toBe(DecisionAction.BLOCK);
    expect(d.rule).toBe('classifier-escalation');
    expect(d.safeAlternative).toBe('use the http.head endpoint instead');
  });

  test('classifier with medium risk escalates ALLOW to APPROVAL', () => {
    const r = req('http.fetch', { url: 'https://example.com' });
    const d = decide(r, {
      classifierAdvice: {
        risk: 0.7,
        intentClass: 'recon',
        suggestedAction: DecisionAction.REQUIRES_APPROVAL,
        rationale: 'looks like recon',
        source: 'openai',
        latencyMs: 200,
      },
      approvalThreshold: RiskLevel.HIGH,
    });
    expect(d.action).toBe(DecisionAction.REQUIRES_APPROVAL);
    expect(d.rule).toBe('classifier-escalation');
  });
});
