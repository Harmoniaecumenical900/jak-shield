/**
 * Block-override policy. Determines whether a BLOCK decision is overridable
 * by a human, and what the override would imply.
 *
 * Rules of thumb (deliberately conservative):
 *
 *   - CRITICAL risk + irreversible action (rm -rf /, DROP TABLE without
 *     WHERE, mkfs, dd if=, fork bomb, payment with no idempotency key,
 *     prod-deploy without ticket) — NEVER overridable. The user has to
 *     change the request, not just acknowledge the danger.
 *
 *   - HIGH risk + reversible / scoped action (external-email PII, social
 *     publish, browser-fetch of a suspicious URL, RBAC step-up to a role
 *     the user has but didn't claim) — overridable WITH heightened
 *     scrutiny for the next 10 calls / 15 minutes.
 *
 *   - MEDIUM risk and below — typically these would be REDACT or
 *     REQUIRES_APPROVAL, not BLOCK. If they ARE BLOCK, they're overridable
 *     with a short scrutiny window (5 calls / 5 minutes).
 *
 *   - Any block while a session is ALREADY under scrutiny — not overridable.
 *     One override per session is enough rope.
 */

import { RiskLevel, type PolicyDecision } from '@jak-shield/shared';
import { newId } from '@jak-shield/core';
import type { BlockOverrideOffer } from '@jak-shield/shared';
import { isUnderScrutiny } from './heightened-scrutiny.js';

/**
 * Rules whose blocks are CRITICAL and never overridable, regardless of how
 * the underlying RiskLevel was set. These are short, irreversible, or
 * regulatory-bright-line cases.
 */
const NEVER_OVERRIDABLE_RULES = new Set<string>([
  'dangerous-shell-fork-bomb',
  'dangerous-shell-disk-wipe',
  'dangerous-shell-recursive-root-delete',
  'dangerous-sql-drop-without-where',
  'dangerous-sql-truncate',
  'dangerous-sql-grant-superuser',
  'payment-no-idempotency',
  'production-deploy-no-ticket',
  'capability-token-replay',
  'capability-token-tampered',
]);

/**
 * Worst-case wording per rule. Shown verbatim to the user before they accept
 * the override. Honest about what the call could do if the block was correct.
 */
const WORST_CASE_WORDING: Record<string, string> = {
  'dangerous-shell': 'Command could modify or delete files outside the sandbox if rule was correct.',
  'dangerous-sql': 'Query could mutate or expose more rows than intended.',
  'external-email-pii': 'Email could leak PII to an external recipient who is not your customer or vendor.',
  'social-publish': 'Post would be publicly visible to all followers of the account.',
  'browser-scrape': 'Page could be a known phishing or credential-harvest site.',
  'filesystem-sandbox': 'Write would touch a path outside the configured sandbox root.',
  'production-deploy': 'Deploy could affect live customer traffic without a tracked change ticket.',
  'rbac-step-up': 'Action requires elevated role; user has it but the calling context did not claim it.',
  'injection-detected': 'Input contained a prompt-injection signature; the downstream model may follow instructions hidden in the data, not your prompt.',
  'pii-bulk-export': 'Call would extract a large set of PII records in one shot — likely a data-exfiltration pattern.',
  'attack-chain-matched': 'Sequence of recent calls matches a known multi-step attack pattern (e.g. recon → exfiltrate, credential-harvest → external send).',
  'taint-violation': 'Call argument contains data tainted by an earlier untrusted source (e.g. a webpage you fetched).',
};

const DEFAULT_WORST_CASE = 'Call could have unintended side effects if the block was correct.';

export interface BuildOfferOpts {
  decision: PolicyDecision;
  tenantId: string;
  sessionId?: string;
  /** Override the default 10-call scrutiny window. */
  scrutinyCalls?: number;
  /** Override the default 60-second token TTL. */
  ttlSeconds?: number;
}

/**
 * Decide whether a BLOCK can be overridden and build the offer envelope.
 * Returns null for non-BLOCK decisions or for un-overridable rules.
 */
export function buildOverrideOffer(opts: BuildOfferOpts): BlockOverrideOffer | null {
  const { decision, tenantId, sessionId } = opts;

  if (decision.action !== 'block') return null;

  const rule = decision.rule ?? 'unknown-rule';

  // Never offer override on hard-stop rules.
  if (NEVER_OVERRIDABLE_RULES.has(rule)) return null;

  // CRITICAL risk → never overridable, even if rule isn't in the explicit set.
  if (decision.risk === RiskLevel.CRITICAL) return null;

  // Already under scrutiny → no second chances this session.
  if (sessionId && isUnderScrutiny(tenantId, sessionId)) return null;

  const blockId = decision.decisionId ?? newId('blk');
  const ruleFamily = rule.split('-').slice(0, 2).join('-'); // 'dangerous-shell-foo' → 'dangerous-shell'
  const worstCase =
    WORST_CASE_WORDING[rule] ??
    WORST_CASE_WORDING[ruleFamily] ??
    DEFAULT_WORST_CASE;

  // Smaller scrutiny window for lower-severity blocks.
  const defaultCalls = decision.risk === RiskLevel.HIGH ? 10 : 5;
  const defaultTtl = decision.risk === RiskLevel.HIGH ? 60 : 45;

  return {
    overridable: true,
    humanReason: decision.reason,
    worstCase,
    scrutinyCalls: opts.scrutinyCalls ?? defaultCalls,
    ttlSeconds: opts.ttlSeconds ?? defaultTtl,
    scopedToRule: rule,
    blockId,
  };
}

/**
 * Attach an override offer to a BLOCK decision in-place (returns the same
 * object for chaining). No-op if the offer is null.
 */
export function attachOverrideOffer(
  decision: PolicyDecision,
  offer: BlockOverrideOffer | null,
): PolicyDecision {
  if (offer) {
    decision.override = offer;
    if (!decision.decisionId) decision.decisionId = offer.blockId;
  }
  return decision;
}

export { NEVER_OVERRIDABLE_RULES };
