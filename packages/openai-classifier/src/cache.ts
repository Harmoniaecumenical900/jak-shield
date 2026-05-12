import { hashArgs } from '@jak-shield/core';
import type { ClassifierAdvice } from '@jak-shield/shared';

interface CacheEntry {
  advice: ClassifierAdvice;
  expiresAt: number;
}

const TTL_MS = Number(process.env.SHIELD_CLASSIFIER_CACHE_TTL_MS ?? 60_000);
const cache = new Map<string, CacheEntry>();

export function classifierCacheKey(toolName: string, args: unknown): string {
  return `${toolName}::${hashArgs(args)}`;
}

export function classifierCacheGet(key: string): ClassifierAdvice | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...entry.advice, cached: true };
}

export function classifierCacheSet(key: string, advice: ClassifierAdvice): void {
  cache.set(key, { advice, expiresAt: Date.now() + TTL_MS });
}

export function classifierCacheClear(): void {
  cache.clear();
}
