/**
 * Override acceptance API. Called from the MCP tool `shield.override_block`
 * (or from the dashboard) when a human says "I accept the risk, run it."
 *
 * What this does, in order:
 *
 *   1. Verifies the original BLOCK decision's HMAC signature so the caller
 *      can't forge an override against a fake block.
 *   2. Verifies the rule is in fact overridable (CRITICAL rules return an
 *      error here even if the caller somehow constructed an offer for one).
 *   3. Records the override in the audit trail (caller is responsible for
 *      passing the audit logger).
 *   4. Begins heightened scrutiny on the session (lowered thresholds + warn
 *      window + 1-strike rule for the next blocks).
 *
 * Returns a single-use capability token that the caller passes to the next
 * call to bypass the same rule. The token is bound to:
 *   - the original block id
 *   - the rule name
 *   - the session id
 *   - a 60-second (default) TTL
 *
 * If any of those don't match on the re-call, the token is rejected and the
 * block stands.
 */

import { verifyDecisionSignature } from '@jak-shield/core';
import { issueCapability } from './capability-tokens.js';
import { beginScrutiny } from './heightened-scrutiny.js';
import { NEVER_OVERRIDABLE_RULES } from './block-override.js';
import { RiskLevel, type PolicyDecision } from '@jak-shield/shared';

export interface AcceptOverrideInput {
  /** The original BLOCK decision returned to the user. Must carry signature + override. */
  blockedDecision: PolicyDecision;
  /** Tenant id of the session. */
  tenantId: string;
  /** Session id — required so we can attach scrutiny to the right session. */
  sessionId: string;
  /** Free-text human reason. Logged. Required for audit. */
  humanReason: string;
  /** User id of the human who clicked "Accept." Required for audit. */
  acceptedBy: string;
  /** Override TTL seconds. Defaults to the offer's ttlSeconds or 60. */
  ttlSeconds?: number;
}

export interface AcceptOverrideResult {
  ok: true;
  /** Single-use capability token. Pass to the next tool call to bypass this rule. */
  overrideToken: string;
  /** When this token expires (epoch ms). */
  expiresAt: number;
  /** How many subsequent calls in this session will run under heightened scrutiny. */
  scrutinyCalls: number;
  /** Audit-trail message ready to log. */
  auditNote: string;
}

export interface AcceptOverrideError {
  ok: false;
  reason: string;
  code: 'NOT_OVERRIDABLE' | 'INVALID_SIGNATURE' | 'NO_OFFER' | 'NOT_A_BLOCK' | 'MISSING_FIELDS';
}

export type AcceptOverrideOutcome = AcceptOverrideResult | AcceptOverrideError;

export function acceptOverride(input: AcceptOverrideInput): AcceptOverrideOutcome {
  const { blockedDecision: d, tenantId, sessionId, humanReason, acceptedBy } = input;

  if (!humanReason || humanReason.trim().length < 8) {
    return {
      ok: false,
      code: 'MISSING_FIELDS',
      reason: 'humanReason must be at least 8 characters — the audit log needs a real reason, not "ok" or "sure".',
    };
  }

  if (d.action !== 'block') {
    return { ok: false, code: 'NOT_A_BLOCK', reason: 'Cannot override a non-BLOCK decision.' };
  }

  if (!d.signature) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      reason: 'Block decision carries no signature — refusing to override what we cannot verify.',
    };
  }

  if (!verifyDecisionSignature(d)) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      reason: 'Block decision signature does not validate. The decision was tampered with, replayed from a different secret epoch, or forged.',
    };
  }

  if (!d.override || !d.override.overridable) {
    return {
      ok: false,
      code: 'NO_OFFER',
      reason: 'This block did not come with an override offer. CRITICAL-risk blocks and certain rules are intentionally non-overridable.',
    };
  }

  if (d.override.scopedToRule && NEVER_OVERRIDABLE_RULES.has(d.override.scopedToRule)) {
    // Belt-and-braces — the offer builder should never have produced this.
    return {
      ok: false,
      code: 'NOT_OVERRIDABLE',
      reason: `Rule "${d.override.scopedToRule}" is on the hard-stop list and never overridable.`,
    };
  }

  if (d.risk === RiskLevel.CRITICAL) {
    return {
      ok: false,
      code: 'NOT_OVERRIDABLE',
      reason: 'CRITICAL-risk blocks are never overridable. Change the request, not the verdict.',
    };
  }

  const ttlSeconds = input.ttlSeconds ?? d.override.ttlSeconds ?? 60;
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // Mint a single-use capability token bound to this exact (tenant, rule,
  // blockId) tuple. The MCP server's next-call check looks for this. Token
  // is created via the existing JWT-shaped capability minter; the `tn`
  // (tool-name) slot carries the rule scope and `ah` carries the blockId
  // instead of an args hash.
  const overrideToken = issueCapability({
    tenantId,
    toolName: `override:${d.override.scopedToRule ?? d.rule ?? 'unknown'}`,
    args: d.override.blockId,
    ttlSeconds,
  });

  // Open the heightened-scrutiny window.
  beginScrutiny({
    tenantId,
    sessionId,
    triggeredBy: d.override.scopedToRule ?? d.rule ?? 'unknown',
    originalBlockId: d.override.blockId,
    scrutinyCalls: d.override.scrutinyCalls,
    ttlMs: 15 * 60 * 1000,
  });

  const auditNote =
    `OVERRIDE_ACCEPTED tenant=${tenantId} session=${sessionId} rule=${d.override.scopedToRule ?? 'unknown'} ` +
    `blockId=${d.override.blockId} acceptedBy=${acceptedBy} reason=${JSON.stringify(humanReason)} ` +
    `scrutinyCalls=${d.override.scrutinyCalls} ttlSeconds=${ttlSeconds}`;

  return {
    ok: true,
    overrideToken,
    expiresAt,
    scrutinyCalls: d.override.scrutinyCalls,
    auditNote,
  };
}
