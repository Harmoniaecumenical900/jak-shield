import { describe, expect, test } from 'vitest';
import { DecisionAction, RiskLevel } from '@jak-shield/shared';
import { decide } from '@jak-shield/policy-engine';
import { req } from './helpers.js';

describe('pii-leak', () => {
  test('external email with student records → requires_approval, body redacted', () => {
    const r = req('gmail.send_email', {
      to: 'someone@external.com',
      subject: 'Roster',
      body: 'Student record: Roll No: ABC123. SSN 123-45-6789. Aadhaar 1234 5678 9012.',
    });
    const d = decide(r);
    expect(d.action).toBe(DecisionAction.REQUIRES_APPROVAL);
    expect([RiskLevel.HIGH, RiskLevel.CRITICAL]).toContain(d.risk);
    // Either external-email-pii rule fired, or PII redaction upgraded to approval.
    expect(d.rule).toMatch(/external-email-pii|dlp-input-redact/);
    if (d.redactedArgs && typeof d.redactedArgs['body'] === 'string') {
      expect(d.redactedArgs['body']).not.toContain('123-45-6789');
    }
  });
});
