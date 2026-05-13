/**
 * Shield pause / resume — user-controlled gateway suspension with strict
 * constraints.
 *
 * Why this exists: sometimes a developer is doing something the gateway
 * (correctly) thinks is dangerous, but they know it's the right thing —
 * running migrations, debugging production data, etc. Hard-blocking and
 * forcing per-call overrides becomes friction. The override flow is per-
 * call; this is per-session/tenant for a bounded window.
 *
 * Why this is not "just disable the gateway":
 *
 *   1. CRITICAL rules NEVER yield to a pause. rm -rf /, DROP TABLE without
 *      WHERE, prod-deploy without ticket, payment without idempotency,
 *      offensive-cyber, capability-token replay — these fire even when
 *      paused. The user changes the request, not the verdict.
 *   2. Pause is time-bounded. Max duration is hard-capped at 1 hour and
 *      defaults to 15 minutes. There is no "indefinite" pause.
 *   3. Pause auto-expires. We never leave the gateway off because someone
 *      forgot to resume.
 *   4. Pause emits an audit event at start, on each call during the window
 *      (with `paused=true` flag), and at end (auto or manual).
 *   5. Every decision during a pause window carries a `paused_state` field
 *      so downstream UIs can show "JAK Shield is paused" prominently.
 *   6. When pause ends, the session enters heightened-scrutiny mode for
 *      the next 10 calls (same window the override flow opens). Pause +
 *      scrutiny is a tighter post-window than override alone.
 *   7. Pause is scoped — session-level, tenant-level, or user-level. Not
 *      "all of JAK Shield globally."
 *   8. CRITICAL-class operations during a pause window still log an audit
 *      entry saying they would have run if the pause had been permissive
 *      (it wasn't). That's the trail an attacker would need to leave.
 */

import { newId } from '@jak-shield/core';
import { beginScrutiny } from './heightened-scrutiny.js';

/** Scope of a pause — controls which calls are affected. */
export type PauseScope = 'session' | 'tenant' | 'user';

/** Hard ceilings. Cannot be exceeded by API. */
export const MAX_PAUSE_MS = 60 * 60 * 1000; // 1 hour
export const DEFAULT_PAUSE_MS = 15 * 60 * 1000; // 15 minutes
export const MIN_REASON_LENGTH = 20;

/**
 * Internal pause state — one per (scope, key). Scope `tenant` and key
 * `tenant-foo` is a separate record from scope `session` and key
 * `tenant-foo::session-xyz`.
 */
interface PauseRecord {
  scope: PauseScope;
  key: string;
  pauseId: string;
  triggeredBy: string; // userId
  reason: string;
  startedAt: number;
  expiresAt: number;
  /** Rules the user explicitly chose to keep enforcing during pause. */
  alsoEnforceRules: Set<string>;
  /**
   * Calls observed under this pause (decisions that would have been
   * affected). Used to drive scrutiny on resume.
   */
  callsObserved: number;
}

const PAUSES = new Map<string, PauseRecord>();

function pauseKey(scope: PauseScope, tenantId: string, sessionId?: string, userId?: string): string {
  switch (scope) {
    case 'tenant':
      return `T::${tenantId}`;
    case 'session':
      return `S::${tenantId}::${sessionId ?? '_'}`;
    case 'user':
      return `U::${tenantId}::${userId ?? '_'}`;
  }
}

export interface BeginPauseInput {
  tenantId: string;
  sessionId?: string;
  userId: string;
  scope: PauseScope;
  reason: string;
  durationMs?: number;
  /** Rules to keep enforcing even during pause (in addition to the
   *  hard-coded never-pausable set in shouldYieldToPause). */
  alsoEnforceRules?: string[];
}

export interface BeginPauseResult {
  ok: true;
  pauseId: string;
  expiresAt: number;
  durationMs: number;
  scope: PauseScope;
  /** Plain-English warning to surface in the response so callers know what
   *  is and is not bypassed. */
  warning: string;
}

export interface BeginPauseError {
  ok: false;
  code: 'REASON_TOO_SHORT' | 'DURATION_TOO_LONG' | 'ALREADY_PAUSED';
  reason: string;
}

export function beginPause(input: BeginPauseInput): BeginPauseResult | BeginPauseError {
  if (!input.reason || input.reason.trim().length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      code: 'REASON_TOO_SHORT',
      reason: `Pause reason must be at least ${MIN_REASON_LENGTH} characters. The audit log needs a real reason, not 'ok'.`,
    };
  }
  const durationMs = Math.min(input.durationMs ?? DEFAULT_PAUSE_MS, MAX_PAUSE_MS);
  if ((input.durationMs ?? 0) > MAX_PAUSE_MS) {
    return {
      ok: false,
      code: 'DURATION_TOO_LONG',
      reason: `Pause duration cannot exceed ${MAX_PAUSE_MS / 60000} minutes. JAK Shield will never let you turn it off indefinitely.`,
    };
  }
  const key = pauseKey(input.scope, input.tenantId, input.sessionId, input.userId);
  const existing = PAUSES.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return {
      ok: false,
      code: 'ALREADY_PAUSED',
      reason: `Scope ${input.scope} is already paused until ${new Date(existing.expiresAt).toISOString()}. Call shield.resume first if you want to re-pause.`,
    };
  }
  const now = Date.now();
  const expiresAt = now + durationMs;
  const pauseId = newId('pause');
  PAUSES.set(key, {
    scope: input.scope,
    key,
    pauseId,
    triggeredBy: input.userId,
    reason: input.reason,
    startedAt: now,
    expiresAt,
    alsoEnforceRules: new Set(input.alsoEnforceRules ?? []),
    callsObserved: 0,
  });
  return {
    ok: true,
    pauseId,
    expiresAt,
    durationMs,
    scope: input.scope,
    warning:
      'JAK Shield is paused for ' +
      Math.round(durationMs / 60000) +
      ' minute(s). CRITICAL-risk rules (rm -rf /, DROP TABLE without WHERE, prod-deploy without ticket, payment without idempotency, offensive-cyber, capability-token replay) STILL fire. When the pause ends, the next 10 calls run under heightened scrutiny.',
  };
}

export interface PauseState {
  active: true;
  scope: PauseScope;
  pauseId: string;
  reason: string;
  triggeredBy: string;
  startedAt: number;
  expiresAt: number;
  msRemaining: number;
  callsObserved: number;
  alsoEnforceRules: string[];
}

/**
 * Look up the active pause that would affect a given (tenant, session, user)
 * call. Returns the most-specific active pause (session > user > tenant) so
 * scope precedence is deterministic.
 */
export function activePauseFor(
  tenantId: string,
  sessionId: string | undefined,
  userId: string,
): PauseState | null {
  const now = Date.now();
  const tryScopes: Array<{ scope: PauseScope; key: string }> = [
    { scope: 'session', key: pauseKey('session', tenantId, sessionId, userId) },
    { scope: 'user', key: pauseKey('user', tenantId, sessionId, userId) },
    { scope: 'tenant', key: pauseKey('tenant', tenantId, sessionId, userId) },
  ];
  for (const t of tryScopes) {
    const r = PAUSES.get(t.key);
    if (!r) continue;
    if (r.expiresAt <= now) {
      // Auto-expire and trigger post-pause scrutiny on the session that
      // observed the most calls. (For tenant/user scope without a session,
      // there's no session to scrutinize — the audit trail is the record.)
      PAUSES.delete(t.key);
      if (sessionId && r.callsObserved > 0) {
        beginScrutiny({
          tenantId,
          sessionId,
          triggeredBy: `pause:${r.scope}:${r.pauseId}`,
          originalBlockId: r.pauseId,
          scrutinyCalls: 10,
          ttlMs: 15 * 60 * 1000,
        });
      }
      continue;
    }
    return {
      active: true,
      scope: r.scope,
      pauseId: r.pauseId,
      reason: r.reason,
      triggeredBy: r.triggeredBy,
      startedAt: r.startedAt,
      expiresAt: r.expiresAt,
      msRemaining: r.expiresAt - now,
      callsObserved: r.callsObserved,
      alsoEnforceRules: Array.from(r.alsoEnforceRules),
    };
  }
  return null;
}

/**
 * Increment the call counter on an active pause. Called from decide() once
 * per decision that flowed through a pause window.
 */
export function tickPauseObserved(
  tenantId: string,
  sessionId: string | undefined,
  userId: string,
): void {
  const now = Date.now();
  for (const scope of ['session', 'user', 'tenant'] as PauseScope[]) {
    const key = pauseKey(scope, tenantId, sessionId, userId);
    const r = PAUSES.get(key);
    if (r && r.expiresAt > now) {
      r.callsObserved += 1;
      break; // most-specific scope wins
    }
  }
}

export interface ResumeInput {
  tenantId: string;
  sessionId?: string;
  userId: string;
  scope: PauseScope;
}

export interface ResumeResult {
  ok: true;
  pauseId: string;
  durationActualMs: number;
  callsObserved: number;
  scrutinyStarted: boolean;
}

export interface ResumeError {
  ok: false;
  code: 'NOT_PAUSED';
  reason: string;
}

/**
 * Manually end an active pause. Triggers heightened scrutiny on the session
 * if there's one to scrutinize. Audit-logged by the caller.
 */
export function resumeShield(input: ResumeInput): ResumeResult | ResumeError {
  const key = pauseKey(input.scope, input.tenantId, input.sessionId, input.userId);
  const r = PAUSES.get(key);
  if (!r) {
    return { ok: false, code: 'NOT_PAUSED', reason: 'No active pause for the given scope.' };
  }
  PAUSES.delete(key);
  let scrutinyStarted = false;
  if (input.sessionId) {
    beginScrutiny({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      triggeredBy: `pause:${r.scope}:${r.pauseId}`,
      originalBlockId: r.pauseId,
      scrutinyCalls: 10,
      ttlMs: 15 * 60 * 1000,
    });
    scrutinyStarted = true;
  }
  return {
    ok: true,
    pauseId: r.pauseId,
    durationActualMs: Date.now() - r.startedAt,
    callsObserved: r.callsObserved,
    scrutinyStarted,
  };
}

/**
 * Decide whether a rule's BLOCK decision should yield to an active pause,
 * or whether it's a "still fires even during pause" rule.
 *
 * Hard-coded non-pausable rules: any rule the user can never disable, even
 * via a perfectly-formed pause request. These are the same as the
 * `NEVER_OVERRIDABLE_RULES` set plus a couple of extras that make sense at
 * the broader pause-scope level.
 */
const NEVER_PAUSABLE_RULES = new Set<string>([
  // copy of NEVER_OVERRIDABLE_RULES
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
  // and a few more that make sense at pause-scope but not override-scope:
  'offensive-cyber',
  'prompt-injection-input',
]);

/**
 * Should this BLOCK decision yield to an active pause?
 *
 *   - If rule is in NEVER_PAUSABLE_RULES → no, fire the block
 *   - If rule is in pause.alsoEnforceRules → no, fire the block
 *   - Otherwise → yes, the pause suppresses this block
 */
export function shouldYieldToPause(rule: string, pause: PauseState): boolean {
  if (NEVER_PAUSABLE_RULES.has(rule)) return false;
  if (pause.alsoEnforceRules.includes(rule)) return false;
  return true;
}

export { NEVER_PAUSABLE_RULES };

/** Test-only: wipe all pause state. */
export function _resetPausesForTests(): void {
  PAUSES.clear();
}
