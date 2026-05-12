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
  return JSON.stringify(obj, Object.keys(obj).sort());
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
