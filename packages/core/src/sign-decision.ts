/**
 * Tamper-evident decision signing. HMAC-SHA256 over the canonicalized
 * decision so a downstream audit reader can detect mutation.
 *
 * Production safety:
 *   - Calling `assertSigningSecretReady()` at boot fails loudly when running
 *     in NODE_ENV=production with the default dev secret. The api / mcp-http
 *     services should call this on startup.
 *   - Key rotation via JAK_SHIELD_DECISION_HMAC + JAK_SHIELD_DECISION_HMAC_PREVIOUS
 *     so verification accepts both keys during a rotation window.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Evidence, PolicyDecision } from '@jak-shield/shared';

const DEV_DEFAULT = 'dev-decision-hmac';

function currentSecret(): Buffer {
  const env = process.env.JAK_SHIELD_DECISION_HMAC ?? process.env.JAK_SHIELD_JWT_SECRET ?? DEV_DEFAULT;
  return Buffer.from(env, 'utf8');
}

function previousSecret(): Buffer | null {
  const env = process.env.JAK_SHIELD_DECISION_HMAC_PREVIOUS;
  return env ? Buffer.from(env, 'utf8') : null;
}

/**
 * Stable, deterministic stringify that sorts keys at every level.
 *
 * Important: this is NOT the same as `JSON.stringify(obj, keysArray)` —
 * that form uses the array as a recursive selector, which would strip nested
 * properties whose keys aren't in the top-level array. Our previous
 * implementation hit that bug and silently dropped the `override` nested
 * object from the signed canonical form, meaning a caller could mutate
 * `override.overridable` without invalidating the HMAC.
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function canonical(d: PolicyDecision): string {
  const fields = ['action', 'risk', 'reason', 'rule', 'safeAlternative', 'approvalId', 'decisionId'] as const;
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    const v = (d as unknown as Record<string, unknown>)[f];
    if (v !== undefined) obj[f] = v;
  }
  if (d.provenance) {
    obj.provenanceEvidence = d.provenance.evidence.map((e: Evidence) => ({
      source: e.source,
      detail: e.detail,
      weight: e.weight,
      validators: e.validators,
    }));
  }
  // Override offer is signed so a downstream caller can't flip `overridable`
  // from false to true without invalidating the HMAC.
  if (d.override) {
    obj.override = {
      overridable: d.override.overridable,
      scopedToRule: d.override.scopedToRule,
      blockId: d.override.blockId,
      scrutinyCalls: d.override.scrutinyCalls,
      ttlSeconds: d.override.ttlSeconds,
    };
  }
  // Heightened-scrutiny state is signed too — prevents a caller from claiming
  // their session is NOT under scrutiny to dodge tighter thresholds.
  if (d.heightenedScrutiny) {
    obj.heightenedScrutiny = {
      callsRemaining: d.heightenedScrutiny.callsRemaining,
      triggeredBy: d.heightenedScrutiny.triggeredBy,
      originalBlockId: d.heightenedScrutiny.originalBlockId,
    };
  }
  return stableStringify(obj);
}

export function signDecision(d: PolicyDecision): PolicyDecision {
  const sig = createHmac('sha256', currentSecret()).update(canonical(d)).digest('hex');
  return { ...d, signature: sig };
}

export function verifyDecisionSignature(d: PolicyDecision): boolean {
  if (!d.signature) return false;
  const a = Buffer.from(d.signature, 'hex');
  for (const sec of [currentSecret(), previousSecret()]) {
    if (!sec) continue;
    const expected = createHmac('sha256', sec).update(canonical(d)).digest('hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * Boot-time assertion. Call from each service entrypoint. Throws if we're
 * running in production but no signing secret has been configured — this
 * prevents an accidental deploy that emits silently-unverifiable decisions.
 */
export function assertSigningSecretReady(): void {
  const env = process.env.NODE_ENV ?? 'development';
  const configured = Boolean(process.env.JAK_SHIELD_DECISION_HMAC ?? process.env.JAK_SHIELD_JWT_SECRET);
  if (env === 'production' && !configured) {
    throw new Error(
      'JAK Shield production boot: JAK_SHIELD_DECISION_HMAC is not set. ' +
      'Refusing to start — decisions would be signed with the dev default. ' +
      'Set JAK_SHIELD_DECISION_HMAC to a high-entropy secret and restart.',
    );
  }
  // Also require the JWT secret to be non-default in production.
  if (env === 'production') {
    const jwt = process.env.JAK_SHIELD_JWT_SECRET;
    if (!jwt || jwt.startsWith('dev-')) {
      throw new Error('JAK Shield production boot: JAK_SHIELD_JWT_SECRET must be set to a non-default value.');
    }
    const cookie = process.env.JAK_SHIELD_COOKIE_SECRET;
    if (!cookie || cookie.startsWith('dev-')) {
      throw new Error('JAK Shield production boot: JAK_SHIELD_COOKIE_SECRET must be set to a non-default value.');
    }
  }
}

export const __TEST_ONLY = { DEV_DEFAULT };
