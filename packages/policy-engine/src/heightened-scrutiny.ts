/**
 * Heightened-scrutiny session state.
 *
 * When a user overrides a JAK Shield block, the session enters a
 * heightened-scrutiny window. Inside that window:
 *
 *   - Anomaly z-score threshold drops from 3.0 to 1.5 (catch more outliers).
 *   - Taint Jaccard threshold drops from 0.30 to 0.15 (catch fuzzier matches
 *     of overridden data flowing into sensitive sinks).
 *   - Every decision carries a `heightenedScrutiny` field so the UI can
 *     surface "still watching."
 *   - If ANY subsequent block fires during the window, it is NOT overridable
 *     regardless of severity — one override is enough rope.
 *   - Warnings accumulate on the session state and surface in the next
 *     decision's provenance.
 *
 * Per-session, in-process. For multi-process production, this state would
 * back onto Redis with the same TTL semantics.
 */

import type { HeightenedScrutinyState, ScrutinyWarning } from '@jak-shield/shared';

interface SessionScrutiny {
  callsRemaining: number;
  triggeredBy: string;
  originalBlockId: string;
  warnings: ScrutinyWarning[];
  /** When this scrutiny window started, for audit. */
  startedAt: string;
  /** Hard expiry — even if calls don't get consumed, scrutiny drops after this. */
  expiresAt: number;
}

const SESSIONS = new Map<string, SessionScrutiny>();

/** Default thresholds when scrutiny is NOT active. */
export const NORMAL_THRESHOLDS = Object.freeze({
  anomalyZScore: 3.0,
  taintJaccard: 0.3,
});

/** Tightened thresholds when scrutiny IS active. */
export const SCRUTINY_THRESHOLDS = Object.freeze({
  anomalyZScore: 1.5,
  taintJaccard: 0.15,
});

/** Default scrutiny window — 10 calls or 15 minutes, whichever expires first. */
const DEFAULT_SCRUTINY_CALLS = 10;
const DEFAULT_SCRUTINY_TTL_MS = 15 * 60 * 1000;

function sessionKey(tenantId: string, sessionId: string): string {
  return `${tenantId}::${sessionId}`;
}

/**
 * Begin heightened scrutiny for a session after an accepted override.
 * Idempotent — re-calling extends the window.
 */
export function beginScrutiny(opts: {
  tenantId: string;
  sessionId: string;
  triggeredBy: string;
  originalBlockId: string;
  scrutinyCalls?: number;
  ttlMs?: number;
}): void {
  const key = sessionKey(opts.tenantId, opts.sessionId);
  const existing = SESSIONS.get(key);
  const callsRemaining = Math.max(
    existing?.callsRemaining ?? 0,
    opts.scrutinyCalls ?? DEFAULT_SCRUTINY_CALLS,
  );
  const ttl = opts.ttlMs ?? DEFAULT_SCRUTINY_TTL_MS;
  SESSIONS.set(key, {
    callsRemaining,
    triggeredBy: opts.triggeredBy,
    originalBlockId: opts.originalBlockId,
    warnings: existing?.warnings ?? [],
    startedAt: existing?.startedAt ?? new Date().toISOString(),
    expiresAt: Math.max(existing?.expiresAt ?? 0, Date.now() + ttl),
  });
}

/**
 * Get current scrutiny state for a session, or null if not under scrutiny.
 * Returns a snapshot (callers cannot mutate). Auto-expires sessions whose TTL
 * has elapsed.
 */
export function getScrutiny(
  tenantId: string,
  sessionId: string,
): HeightenedScrutinyState | null {
  const key = sessionKey(tenantId, sessionId);
  const s = SESSIONS.get(key);
  if (!s) return null;
  if (Date.now() >= s.expiresAt || s.callsRemaining <= 0) {
    SESSIONS.delete(key);
    return null;
  }
  return {
    active: true,
    callsRemaining: s.callsRemaining,
    triggeredBy: s.triggeredBy,
    originalBlockId: s.originalBlockId,
    thresholds: { ...SCRUTINY_THRESHOLDS },
    warnings: [...s.warnings],
  };
}

/**
 * Decrement the calls-remaining counter on a session. Call this after every
 * decision while under scrutiny.
 */
export function tickScrutiny(tenantId: string, sessionId: string): void {
  const key = sessionKey(tenantId, sessionId);
  const s = SESSIONS.get(key);
  if (!s) return;
  s.callsRemaining -= 1;
  if (s.callsRemaining <= 0 || Date.now() >= s.expiresAt) {
    SESSIONS.delete(key);
  }
}

/**
 * Add a warning to the scrutiny state. Used when a detector fires while under
 * scrutiny but doesn't escalate to a full block.
 */
export function addScrutinyWarning(
  tenantId: string,
  sessionId: string,
  warning: Omit<ScrutinyWarning, 'at'>,
): void {
  const key = sessionKey(tenantId, sessionId);
  const s = SESSIONS.get(key);
  if (!s) return;
  s.warnings.push({ ...warning, at: new Date().toISOString() });
  // Cap warnings per session to avoid unbounded growth.
  if (s.warnings.length > 50) s.warnings.splice(0, s.warnings.length - 50);
}

/**
 * Check if a session is under scrutiny. Cheap, no allocation.
 */
export function isUnderScrutiny(tenantId: string, sessionId: string): boolean {
  const key = sessionKey(tenantId, sessionId);
  const s = SESSIONS.get(key);
  if (!s) return false;
  if (Date.now() >= s.expiresAt || s.callsRemaining <= 0) {
    SESSIONS.delete(key);
    return false;
  }
  return true;
}

/**
 * End scrutiny early — e.g. when the user explicitly "stands down" or when
 * the tenant admin clears the session.
 */
export function endScrutiny(tenantId: string, sessionId: string): void {
  SESSIONS.delete(sessionKey(tenantId, sessionId));
}

/**
 * Get the active threshold set for a session (normal or tightened).
 */
export function activeThresholds(
  tenantId: string,
  sessionId: string,
): { anomalyZScore: number; taintJaccard: number } {
  return isUnderScrutiny(tenantId, sessionId) ? { ...SCRUTINY_THRESHOLDS } : { ...NORMAL_THRESHOLDS };
}

/**
 * Test-only: wipe all session state. Real callers should use endScrutiny().
 */
export function _resetForTests(): void {
  SESSIONS.clear();
}
