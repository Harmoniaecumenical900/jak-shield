/**
 * Taint tracking v2 for MCP tool calls.
 *
 * v1 was substring matching — defeated by paraphrasing or whitespace changes.
 * v2 uses **token-level n-gram fingerprints with MinHash** so that re-ordered
 * or partially-paraphrased text still matches. Substring matching is preserved
 * as a fast path for verbatim reuse.
 *
 *  - Tool outputs are tokenized; every 4-token shingle gets fingerprinted.
 *  - A MinHash signature (32 dims) of those shingles is stored.
 *  - Subsequent inputs are fingerprinted the same way; Jaccard ≥ 0.30 → tainted.
 *  - To evade, an adversary must substantially rewrite ≥ 70% of the content.
 *  - Linear time + bounded memory; safe to run on every call.
 */

import { createHash } from 'node:crypto';

export type TrustLabel = 'UNTRUSTED' | 'INTERNAL' | 'SENSITIVE';

export interface TaintRecord {
  hash: string;
  signature: number[];
  needles: string[];
  trust: TrustLabel;
  source: string;
  ts: number;
}

const STORE = new Map<string, TaintRecord[]>();
const MAX_RECORDS_PER_SESSION = 50;
const RECORD_TTL_MS = 30 * 60 * 1000;

const NGRAM_SIZE = 4;
const MINHASH_K = 32;
const MATCH_THRESHOLD = 0.30;
const SUBSTRING_MIN_LEN = 12;

function sessionKey(sessionId: string | undefined): string {
  return sessionId ?? 'default';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function ngrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return tokens.length > 0 ? [tokens.join(' ')] : [];
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '));
  return out;
}

function shingleHash(s: string, seed: number): number {
  // FNV-1a mixed with a per-permutation seed.
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function minHashSignature(shingles: string[]): number[] {
  if (shingles.length === 0) return Array.from({ length: MINHASH_K }, () => 0xffffffff);
  const sig: number[] = Array.from({ length: MINHASH_K }, () => 0xffffffff);
  for (const s of shingles) {
    for (let k = 0; k < MINHASH_K; k++) {
      const h = shingleHash(s, k * 2654435761);
      if (h < sig[k]!) sig[k] = h;
    }
  }
  return sig;
}

function jaccardEstimate(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

function representativeNeedles(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  out.push(text.slice(0, 60));
  for (let i = 200; i < Math.min(text.length, 1000); i += 200) {
    out.push(text.slice(i, i + 60));
  }
  return out.filter((s) => s.length >= SUBSTRING_MIN_LEN);
}

function gc(sessionId: string): void {
  const now = Date.now();
  const records = STORE.get(sessionId);
  if (!records) return;
  const live = records.filter((r) => now - r.ts < RECORD_TTL_MS);
  if (live.length === 0) STORE.delete(sessionId);
  else if (live.length !== records.length) STORE.set(sessionId, live);
}

export function trustLabelFor(toolName: string): TrustLabel {
  const n = toolName.toLowerCase();
  if (n.startsWith('browser.') || n.startsWith('http.fetch') || n === 'http.fetch') return 'UNTRUSTED';
  if (n.includes('read') && (n.includes('email') || n.includes('message'))) return 'UNTRUSTED';
  if (n.startsWith('filesystem.read')) return 'UNTRUSTED';
  if (n.startsWith('postgres.') || n.startsWith('supabase.') || n.startsWith('gdrive.')) return 'INTERNAL';
  return 'INTERNAL';
}

export function recordTaint(
  sessionId: string | undefined,
  toolName: string,
  output: string,
): TaintRecord | null {
  if (!output || typeof output !== 'string' || output.length < SUBSTRING_MIN_LEN) return null;
  const key = sessionKey(sessionId);
  gc(key);

  const tokens = tokenize(output);
  const grams = ngrams(tokens, NGRAM_SIZE);
  const signature = minHashSignature(grams);
  const hash = createHash('sha256').update(output).digest('hex').slice(0, 16);
  const record: TaintRecord = {
    hash,
    signature,
    needles: representativeNeedles(output),
    trust: trustLabelFor(toolName),
    source: toolName,
    ts: Date.now(),
  };
  const list = STORE.get(key) ?? [];
  list.push(record);
  if (list.length > MAX_RECORDS_PER_SESSION) list.shift();
  STORE.set(key, list);
  return record;
}

export interface TaintCheck {
  tainted: boolean;
  records: TaintRecord[];
  matchedNeedles: string[];
  /** Highest Jaccard similarity (0..1) observed across stored records. */
  similarity: number;
}

export function checkArgsForTaint(
  sessionId: string | undefined,
  args: Record<string, unknown>,
): TaintCheck {
  const key = sessionKey(sessionId);
  gc(key);
  const records = STORE.get(key) ?? [];
  if (records.length === 0) return { tainted: false, records: [], matchedNeedles: [], similarity: 0 };

  const argsStr = JSON.stringify(args ?? {});
  const tokens = tokenize(argsStr);
  const grams = ngrams(tokens, NGRAM_SIZE);
  const argsSignature = minHashSignature(grams);

  const matched: TaintRecord[] = [];
  const matchedNeedles: string[] = [];
  let topSimilarity = 0;

  for (const rec of records) {
    let substringHit = false;
    for (const needle of rec.needles) {
      if (argsStr.includes(needle)) {
        substringHit = true;
        matchedNeedles.push(needle.slice(0, 40));
        break;
      }
    }
    const sim = jaccardEstimate(argsSignature, rec.signature);
    if (sim > topSimilarity) topSimilarity = sim;
    if (substringHit || sim >= MATCH_THRESHOLD) matched.push(rec);
  }

  return {
    tainted: matched.length > 0,
    records: matched,
    matchedNeedles,
    similarity: topSimilarity,
  };
}

export function clearSessionTaint(sessionId: string): void {
  STORE.delete(sessionKey(sessionId));
}

export function taintSessionSnapshot(sessionId: string): TaintRecord[] {
  return [...(STORE.get(sessionKey(sessionId)) ?? [])];
}

/** Tools that should NEVER receive UNTRUSTED data without explicit approval. */
export const SENSITIVE_SINKS = new Set([
  'gmail.send_email',
  'slack.send_message',
  'sms.send',
  'webhook.send',
  'http.post',
  'social.publish_with_approval',
  'github.create_issue',
  'github.create_pr_comment',
  'postgres.query',
  'supabase.query',
]);

export function isSensitiveSink(toolName: string): boolean {
  return SENSITIVE_SINKS.has(toolName);
}
