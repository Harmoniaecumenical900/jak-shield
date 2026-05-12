/**
 * Per-target circuit breaker for connector calls. Three states: CLOSED (normal),
 * OPEN (failing — short-circuit), HALF_OPEN (probe). After N failures we open
 * for a cooldown window; one probe then closes or re-opens.
 */

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface Circuit {
  state: State;
  failures: number;
  successes: number;
  openedAt: number;
  threshold: number;
  cooldownMs: number;
}

const CIRCUITS = new Map<string, Circuit>();

export interface CircuitConfig {
  failureThreshold: number;
  cooldownMs: number;
}

const DEFAULT: CircuitConfig = { failureThreshold: 5, cooldownMs: 30_000 };

export function shouldAttempt(target: string, config: CircuitConfig = DEFAULT): { allowed: boolean; state: State; reason?: string } {
  let c = CIRCUITS.get(target);
  if (!c) {
    c = { state: 'CLOSED', failures: 0, successes: 0, openedAt: 0, threshold: config.failureThreshold, cooldownMs: config.cooldownMs };
    CIRCUITS.set(target, c);
  }
  const now = Date.now();
  if (c.state === 'OPEN') {
    if (now - c.openedAt >= c.cooldownMs) {
      c.state = 'HALF_OPEN';
      return { allowed: true, state: c.state };
    }
    return { allowed: false, state: c.state, reason: `circuit open; retry in ${Math.ceil((c.cooldownMs - (now - c.openedAt)) / 1000)}s` };
  }
  return { allowed: true, state: c.state };
}

export function recordSuccess(target: string): void {
  const c = CIRCUITS.get(target);
  if (!c) return;
  c.successes++;
  c.failures = 0;
  c.state = 'CLOSED';
}

export function recordFailure(target: string): void {
  const c = CIRCUITS.get(target);
  if (!c) return;
  c.failures++;
  if (c.state === 'HALF_OPEN' || c.failures >= c.threshold) {
    c.state = 'OPEN';
    c.openedAt = Date.now();
  }
}

export function circuitSnapshot(): Record<string, { state: State; failures: number; successes: number }> {
  const out: Record<string, { state: State; failures: number; successes: number }> = {};
  for (const [k, c] of CIRCUITS.entries()) out[k] = { state: c.state, failures: c.failures, successes: c.successes };
  return out;
}

export function resetCircuits(): void {
  CIRCUITS.clear();
}
