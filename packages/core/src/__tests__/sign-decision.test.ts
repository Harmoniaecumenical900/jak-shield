import { beforeEach, describe, expect, test } from 'vitest';
import { signDecision, verifyDecisionSignature, assertSigningSecretReady } from '../sign-decision.js';
import { DecisionAction, RiskLevel } from '@jak-shield/shared';

const sampleDecision = () => ({
  action: DecisionAction.BLOCK,
  risk: RiskLevel.HIGH,
  reason: 'sample',
  rule: 'unit-test',
});

beforeEach(() => {
  process.env.JAK_SHIELD_DECISION_HMAC = 'test-decision-secret';
  delete process.env.JAK_SHIELD_DECISION_HMAC_PREVIOUS;
  process.env.NODE_ENV = 'test';
});

describe('decision signing', () => {
  test('signed decision verifies', () => {
    const signed = signDecision(sampleDecision());
    expect(signed.signature).toBeTruthy();
    expect(verifyDecisionSignature(signed)).toBe(true);
  });

  test('mutated reason invalidates signature', () => {
    const signed = signDecision(sampleDecision());
    const mutated = { ...signed, reason: 'tampered' };
    expect(verifyDecisionSignature(mutated)).toBe(false);
  });

  test('mutated action invalidates signature', () => {
    const signed = signDecision(sampleDecision());
    const mutated = { ...signed, action: DecisionAction.ALLOW };
    expect(verifyDecisionSignature(mutated)).toBe(false);
  });

  test('rotation: old signature accepted with previous-key window', () => {
    process.env.JAK_SHIELD_DECISION_HMAC = 'old-key';
    const oldSigned = signDecision(sampleDecision());
    process.env.JAK_SHIELD_DECISION_HMAC = 'new-key';
    process.env.JAK_SHIELD_DECISION_HMAC_PREVIOUS = 'old-key';
    expect(verifyDecisionSignature(oldSigned)).toBe(true);
  });

  test('unsigned decision fails verification', () => {
    expect(verifyDecisionSignature(sampleDecision())).toBe(false);
  });

  // Regression test — previously the mcp-server attached approvalId AFTER
  // signing, so downstream verification saw a different canonical form.
  test('re-signing covers approvalId mutation (regression for live-demo bug)', () => {
    const initial = signDecision(sampleDecision());
    // Simulate the evaluate.ts path: mutate, re-sign.
    const withApproval = signDecision({ ...initial, approvalId: 'apr_abc123' });
    expect(verifyDecisionSignature(withApproval)).toBe(true);
    // But the original signature on a mutated decision should fail.
    const naivelyMutated = { ...initial, approvalId: 'apr_abc123' };
    expect(verifyDecisionSignature(naivelyMutated)).toBe(false);
  });
});

describe('assertSigningSecretReady', () => {
  test('throws in production without secrets', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JAK_SHIELD_DECISION_HMAC;
    delete process.env.JAK_SHIELD_JWT_SECRET;
    expect(() => assertSigningSecretReady()).toThrow(/JAK_SHIELD_DECISION_HMAC/);
  });

  test('throws in production with default JWT secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JAK_SHIELD_DECISION_HMAC = 'real-secret';
    process.env.JAK_SHIELD_JWT_SECRET = 'dev-jwt-secret-change-me';
    expect(() => assertSigningSecretReady()).toThrow(/JAK_SHIELD_JWT_SECRET/);
  });

  test('passes in production with real secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JAK_SHIELD_DECISION_HMAC = 'real-secret';
    process.env.JAK_SHIELD_JWT_SECRET = 'real-jwt-secret-32-chars-min-12345';
    process.env.JAK_SHIELD_COOKIE_SECRET = 'real-cookie-secret-32-chars-12345';
    expect(() => assertSigningSecretReady()).not.toThrow();
  });

  test('always passes in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JAK_SHIELD_DECISION_HMAC;
    expect(() => assertSigningSecretReady()).not.toThrow();
  });
});
