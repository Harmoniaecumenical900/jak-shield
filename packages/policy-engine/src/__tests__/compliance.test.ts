import { describe, expect, test } from 'vitest';
import { ComplianceTag } from '@jak-shield/shared';
import { evaluateRegulatoryHints, tagCompliance, COMPLIANCE_DISCLAIMER } from '../compliance.js';
import type { PIIFindingV2 } from '@jak-shield/dlp';

function f(type: PIIFindingV2['type'], confidence = 0.9): PIIFindingV2 {
  return {
    type,
    sample: 'redacted',
    startIndex: 0,
    endIndex: 0,
    validators: ['regex'],
    confidence,
  };
}

describe('regulatory signals (compliance.ts)', () => {
  test('credit card → PCI_DSS', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: {}, piiFindings: [f('CREDIT_CARD')] });
    expect(r.tags).toContain(ComplianceTag.PCI_DSS);
  });

  test('SSN → HIPAA', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: {}, piiFindings: [f('SSN')] });
    expect(r.tags).toContain(ComplianceTag.HIPAA);
  });

  test('Aadhaar → DPDP', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: {}, piiFindings: [f('AADHAAR')] });
    expect(r.tags).toContain(ComplianceTag.DPDP);
  });

  test('Student record → FERPA', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: {}, piiFindings: [f('STUDENT_RECORD')] });
    expect(r.tags).toContain(ComplianceTag.FERPA);
  });

  test('financial tool name → SOX', () => {
    const r = evaluateRegulatoryHints({ toolName: 'submit_payment', args: {} });
    expect(r.tags).toContain(ComplianceTag.SOX);
  });

  test('EU domain recipient → GDPR (when no direct PII)', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: { to: 'user@firm.eu' } });
    expect(r.tags).toContain(ComplianceTag.GDPR);
  });

  test('disclaimer is always present', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: {}, piiFindings: [f('SSN')] });
    expect(r.disclaimer).toBe(COMPLIANCE_DISCLAIMER);
    expect(r.disclaimer).toContain('triage signals only');
  });

  test('hints carry confidence and citations', () => {
    const r = evaluateRegulatoryHints({ toolName: 't', args: {}, piiFindings: [f('SSN')] });
    const hipaa = r.hints.find((h) => h.framework === ComplianceTag.HIPAA);
    expect(hipaa?.citation).toContain('45 CFR');
    expect(hipaa?.confidence).toBeGreaterThan(0);
    expect(hipaa?.confidence).toBeLessThanOrEqual(1);
  });

  test('no PII / benign tool → empty tags', () => {
    const r = evaluateRegulatoryHints({ toolName: 'filesystem.list', args: {} });
    expect(r.tags).toEqual([]);
  });

  test('backwards-compat tagCompliance returns same tags as full hints', () => {
    const input = { toolName: 'submit_payment', args: {}, piiFindings: [f('CREDIT_CARD')] };
    const tags = tagCompliance(input);
    const hints = evaluateRegulatoryHints(input).tags;
    expect(new Set(tags)).toEqual(new Set(hints));
  });
});
