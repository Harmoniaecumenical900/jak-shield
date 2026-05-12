import { beforeEach, describe, expect, test } from 'vitest';
import {
  counter,
  gauge,
  histogram,
  renderPrometheus,
} from '../metrics.js';
import { consume, resetRateLimit } from '../rate-limit.js';
import { recordFailure, recordSuccess, resetCircuits, shouldAttempt } from '../circuit-breaker.js';

describe('metrics', () => {
  test('counter increments and renders', () => {
    const c = counter('test_counter', 'A test counter');
    c.inc({ x: 'a' });
    c.inc({ x: 'a' });
    c.inc({ x: 'b' });
    const out = renderPrometheus();
    expect(out).toContain('test_counter{x="a"} 2');
    expect(out).toContain('test_counter{x="b"} 1');
  });

  test('gauge set/inc/dec', () => {
    const g = gauge('test_gauge', 'A test gauge');
    g.set(5);
    g.inc(2);
    g.dec(1);
    expect(renderPrometheus()).toContain('test_gauge 6');
  });

  test('histogram observes and emits buckets', () => {
    const h = histogram('test_hist', 'A test histogram', [10, 50, 100]);
    h.observe(5);
    h.observe(75);
    h.observe(500);
    const out = renderPrometheus();
    expect(out).toContain('test_hist_count');
    expect(out).toContain('test_hist_sum');
  });
});

describe('rate limiter', () => {
  beforeEach(() => resetRateLimit());

  test('allows up to capacity', () => {
    const cfg = { capacity: 5, refillPerSecond: 0 };
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      const r = consume('k1', 1, cfg);
      if (r.allowed) allowed++;
    }
    expect(allowed).toBe(5);
  });

  test('different keys have separate buckets', () => {
    const cfg = { capacity: 1, refillPerSecond: 0 };
    expect(consume('a', 1, cfg).allowed).toBe(true);
    expect(consume('b', 1, cfg).allowed).toBe(true);
    expect(consume('a', 1, cfg).allowed).toBe(false);
  });

  test('refills over time', async () => {
    const cfg = { capacity: 1, refillPerSecond: 10 };
    expect(consume('c', 1, cfg).allowed).toBe(true);
    expect(consume('c', 1, cfg).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 150));
    expect(consume('c', 1, cfg).allowed).toBe(true);
  });
});

describe('circuit breaker', () => {
  beforeEach(() => resetCircuits());

  test('opens after threshold failures', () => {
    const cfg = { failureThreshold: 3, cooldownMs: 1000 };
    expect(shouldAttempt('svc', cfg).state).toBe('CLOSED');
    recordFailure('svc');
    recordFailure('svc');
    recordFailure('svc');
    const r = shouldAttempt('svc', cfg);
    expect(r.allowed).toBe(false);
    expect(r.state).toBe('OPEN');
  });

  test('recordSuccess closes circuit', () => {
    const cfg = { failureThreshold: 3, cooldownMs: 1000 };
    shouldAttempt('svc2', cfg);
    recordFailure('svc2');
    recordSuccess('svc2');
    expect(shouldAttempt('svc2', cfg).state).toBe('CLOSED');
  });
});
