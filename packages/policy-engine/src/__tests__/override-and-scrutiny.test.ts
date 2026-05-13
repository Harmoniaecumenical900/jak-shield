/**
 * Tests for the block-override + heightened-scrutiny pattern.
 *
 * What we're proving:
 *   1. CRITICAL-risk blocks are NEVER overridable (the offer is null).
 *   2. Rules on the never-override list are not overridable even at HIGH.
 *   3. A HIGH-risk overridable block produces a valid offer.
 *   4. Accepting an override returns a token + opens a scrutiny window.
 *   5. While under scrutiny, the next decisions carry `heightenedScrutiny`.
 *   6. While under scrutiny, a second block is NOT overridable.
 *   7. Tampering with the override field on a block invalidates the signature.
 *   8. The scrutiny window expires after `scrutinyCalls` ticks.
 *   9. Tampering with reason/severity to fake an override-friendly block fails.
 *  10. `endScrutiny` immediately drops the state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionAction, RiskLevel, UserRole } from '@jak-shield/shared';
import type { PolicyDecision } from '@jak-shield/shared';
import { signDecision, verifyDecisionSignature } from '@jak-shield/core';
import {
  buildOverrideOffer,
  attachOverrideOffer,
  NEVER_OVERRIDABLE_RULES,
} from '../block-override.js';
import { acceptOverride } from '../accept-override.js';
import {
  beginScrutiny,
  getScrutiny,
  endScrutiny,
  isUnderScrutiny,
  tickScrutiny,
  _resetForTests,
} from '../heightened-scrutiny.js';

const TENANT = 'tenant-test';
const SESSION = 'sess-test';
const USER = 'user-test';

function block(opts: { risk: RiskLevel; rule: string; reason?: string }): PolicyDecision {
  return {
    action: DecisionAction.BLOCK,
    risk: opts.risk,
    reason: opts.reason ?? `Test block via ${opts.rule}`,
    rule: opts.rule,
    decisionId: `dec_${opts.rule}_${Date.now()}`,
  };
}

describe('block-override offer builder', () => {
  beforeEach(() => _resetForTests());

  it('CRITICAL-risk blocks are never overridable', () => {
    const d = block({ risk: RiskLevel.CRITICAL, rule: 'arbitrary-rule' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    expect(offer).toBeNull();
  });

  it('rules on the never-override list are not overridable, even at HIGH risk', () => {
    for (const rule of NEVER_OVERRIDABLE_RULES) {
      const d = block({ risk: RiskLevel.HIGH, rule });
      const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
      expect(offer, `rule ${rule} should not be overridable`).toBeNull();
    }
  });

  it('HIGH-risk overridable block produces a valid offer', () => {
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    expect(offer).not.toBeNull();
    expect(offer!.overridable).toBe(true);
    expect(offer!.scopedToRule).toBe('external-email-pii');
    expect(offer!.scrutinyCalls).toBe(10);
    expect(offer!.ttlSeconds).toBe(60);
    expect(offer!.worstCase).toContain('PII');
  });

  it('MEDIUM-risk overridable block has a shorter scrutiny window', () => {
    const d = block({ risk: RiskLevel.MEDIUM, rule: 'browser-scrape' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    expect(offer).not.toBeNull();
    expect(offer!.scrutinyCalls).toBe(5);
    expect(offer!.ttlSeconds).toBe(45);
  });

  it('attachOverrideOffer is a no-op when offer is null', () => {
    const d = block({ risk: RiskLevel.CRITICAL, rule: 'rm-rf' });
    const result = attachOverrideOffer(d, null);
    expect(result.override).toBeUndefined();
  });
});

describe('acceptOverride()', () => {
  beforeEach(() => _resetForTests());

  it('refuses a non-BLOCK decision', () => {
    const d: PolicyDecision = {
      action: DecisionAction.ALLOW,
      risk: RiskLevel.LOW,
      reason: 'ok',
    };
    const signed = signDecision(d);
    const r = acceptOverride({
      blockedDecision: signed,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'I want to override an allow somehow',
      acceptedBy: USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NOT_A_BLOCK');
  });

  it('refuses if signature missing', () => {
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    attachOverrideOffer(d, offer);
    // Deliberately do NOT sign.
    const r = acceptOverride({
      blockedDecision: d,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'override the unsigned block',
      acceptedBy: USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_SIGNATURE');
  });

  it('refuses if reason is too short', () => {
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    attachOverrideOffer(d, offer);
    const signed = signDecision(d);
    const r = acceptOverride({
      blockedDecision: signed,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'ok', // too short
      acceptedBy: USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_FIELDS');
  });

  it('refuses if the block has no override offer', () => {
    const d = block({ risk: RiskLevel.CRITICAL, rule: 'dangerous-sql-drop-without-where' });
    const signed = signDecision(d);
    const r = acceptOverride({
      blockedDecision: signed,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'I really really need this',
      acceptedBy: USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_OFFER');
  });

  it('accepts a valid override and starts scrutiny', () => {
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    attachOverrideOffer(d, offer);
    const signed = signDecision(d);
    expect(verifyDecisionSignature(signed)).toBe(true);

    const r = acceptOverride({
      blockedDecision: signed,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'partner is a vendor we vetted yesterday',
      acceptedBy: USER,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overrideToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT shape
      expect(r.scrutinyCalls).toBe(10);
      expect(r.expiresAt).toBeGreaterThan(Date.now());
      expect(isUnderScrutiny(TENANT, SESSION)).toBe(true);
    }
  });

  it('rejects override if signed decision was tampered', () => {
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    attachOverrideOffer(d, offer);
    const signed = signDecision(d);
    // Tamper: flip risk from HIGH to LOW after signing.
    const tampered = { ...signed, risk: RiskLevel.LOW };
    const r = acceptOverride({
      blockedDecision: tampered,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'try to slip a tampered block past the override gate',
      acceptedBy: USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects override if `overridable` was flipped from false to true post-signing', () => {
    // Build a CRITICAL block (which should have no offer), then forge one.
    const d = block({ risk: RiskLevel.CRITICAL, rule: 'arbitrary-critical' });
    const signed = signDecision(d);
    // Forge an offer post-signing.
    const forged: PolicyDecision = {
      ...signed,
      override: {
        overridable: true,
        humanReason: 'forged',
        worstCase: 'whatever',
        scrutinyCalls: 10,
        ttlSeconds: 60,
        blockId: 'forged-block-id',
        scopedToRule: 'arbitrary-critical',
      },
    };
    const r = acceptOverride({
      blockedDecision: forged,
      tenantId: TENANT,
      sessionId: SESSION,
      humanReason: 'forging a critical block override',
      acceptedBy: USER,
    });
    expect(r.ok).toBe(false);
    // Could fail either INVALID_SIGNATURE (because override is in canonical)
    // or NOT_OVERRIDABLE (because CRITICAL). Either is correct.
    if (!r.ok) expect(['INVALID_SIGNATURE', 'NOT_OVERRIDABLE']).toContain(r.code);
  });
});

describe('heightened-scrutiny session state', () => {
  beforeEach(() => _resetForTests());

  it('begins, tracks calls remaining, and auto-expires', () => {
    beginScrutiny({
      tenantId: TENANT,
      sessionId: SESSION,
      triggeredBy: 'external-email-pii',
      originalBlockId: 'blk_test',
      scrutinyCalls: 3,
    });
    expect(isUnderScrutiny(TENANT, SESSION)).toBe(true);
    expect(getScrutiny(TENANT, SESSION)?.callsRemaining).toBe(3);
    tickScrutiny(TENANT, SESSION);
    tickScrutiny(TENANT, SESSION);
    expect(getScrutiny(TENANT, SESSION)?.callsRemaining).toBe(1);
    tickScrutiny(TENANT, SESSION);
    expect(isUnderScrutiny(TENANT, SESSION)).toBe(false);
  });

  it('endScrutiny drops the state immediately', () => {
    beginScrutiny({
      tenantId: TENANT,
      sessionId: SESSION,
      triggeredBy: 'external-email-pii',
      originalBlockId: 'blk_test',
    });
    expect(isUnderScrutiny(TENANT, SESSION)).toBe(true);
    endScrutiny(TENANT, SESSION);
    expect(isUnderScrutiny(TENANT, SESSION)).toBe(false);
  });

  it('a block during a scrutiny window is NOT overridable (one-strike rule)', () => {
    beginScrutiny({
      tenantId: TENANT,
      sessionId: SESSION,
      triggeredBy: 'first-rule',
      originalBlockId: 'blk_first',
    });
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT, sessionId: SESSION });
    expect(offer).toBeNull();
  });

  it('exposes tightened thresholds when scrutiny is active', () => {
    beginScrutiny({
      tenantId: TENANT,
      sessionId: SESSION,
      triggeredBy: 'whatever',
      originalBlockId: 'blk_x',
    });
    const s = getScrutiny(TENANT, SESSION);
    expect(s).not.toBeNull();
    expect(s!.thresholds.anomalyZScore).toBeLessThan(3.0);
    expect(s!.thresholds.taintJaccard).toBeLessThan(0.3);
  });
});

describe('signed decision integrity with override fields', () => {
  it('signature covers the override offer (flipping overridable invalidates it)', () => {
    const d = block({ risk: RiskLevel.HIGH, rule: 'external-email-pii' });
    const offer = buildOverrideOffer({ decision: d, tenantId: TENANT });
    attachOverrideOffer(d, offer);
    const signed = signDecision(d);
    expect(verifyDecisionSignature(signed)).toBe(true);

    const tampered: PolicyDecision = {
      ...signed,
      override: { ...signed.override!, overridable: false },
    };
    expect(verifyDecisionSignature(tampered)).toBe(false);
  });
});
