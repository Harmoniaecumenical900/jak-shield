/**
 * Token-bucket rate limiter per key (tenant id, api key id, etc.).
 * In-memory only — see exportSnapshot/importSnapshot for persistence hooks.
 */

interface Bucket {
  tokens: number;
  capacity: number;
  refillPerMs: number;
  lastRefill: number;
}

const BUCKETS = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Bucket capacity (max burst). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
}

const DEFAULT_CONFIG: RateLimitConfig = { capacity: 60, refillPerSecond: 1 };

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function consume(key: string, cost = 1, config: RateLimitConfig = DEFAULT_CONFIG): RateLimitResult {
  const now = Date.now();
  let b = BUCKETS.get(key);
  if (!b) {
    b = {
      tokens: config.capacity,
      capacity: config.capacity,
      refillPerMs: config.refillPerSecond / 1000,
      lastRefill: now,
    };
    BUCKETS.set(key, b);
  }
  // Refill since last update.
  const elapsed = now - b.lastRefill;
  if (elapsed > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillPerMs);
    b.lastRefill = now;
  }
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return {
      allowed: true,
      remaining: Math.floor(b.tokens),
      resetMs: Math.ceil((b.capacity - b.tokens) / b.refillPerMs),
    };
  }
  const needed = cost - b.tokens;
  return {
    allowed: false,
    remaining: Math.floor(b.tokens),
    resetMs: Math.ceil(needed / b.refillPerMs),
  };
}

export function resetRateLimit(key?: string): void {
  if (key) BUCKETS.delete(key);
  else BUCKETS.clear();
}
