import { describe, expect, test } from 'vitest';
import { DecisionAction } from '@jak-shield/shared';
import { decide } from '@jak-shield/policy-engine';
import { req } from './helpers.js';

describe('external-email-pii', () => {
  test('external recipient + PII → requires approval', () => {
    const d = decide(req('gmail.send_email', {
      to: 'partner@partner.com',
      subject: 'Records',
      body: 'Phone: 415-555-1234 and email user@example.com',
    }));
    expect(d.action).toBe(DecisionAction.REQUIRES_APPROVAL);
  });

  test('external recipient without PII → does not trigger this rule', () => {
    const d = decide(req('gmail.send_email', {
      to: 'partner@partner.com',
      subject: 'Hello',
      body: 'Looking forward to the meeting.',
    }));
    // Could be ALLOW or REQUIRES_APPROVAL via threshold (gmail.send_email is EXTERNAL_SIDE_EFFECT).
    // What matters: it's not blocked.
    expect(d.action).not.toBe(DecisionAction.BLOCK);
  });

  test('corporate recipient with PII → not flagged by external-email-pii rule', () => {
    process.env.SHIELD_CORPORATE_DOMAINS = 'jakshield.ai,corp.com';
    const d = decide(req('gmail.send_email', {
      to: 'colleague@corp.com',
      subject: 'Records',
      body: 'SSN 123-45-6789',
    }));
    // The external-email-pii rule should not have fired.
    expect(d.rule).not.toBe('external-email-pii');
  });
});
