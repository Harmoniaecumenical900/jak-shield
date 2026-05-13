#!/usr/bin/env node
/**
 * One-shot script to replace stale perf + count claims across launch materials.
 *
 * Old → New (based on freshly measured numbers from bench/perf-bench.mjs,
 * three consecutive runs on the current dev machine):
 *
 *   p95 latency       0.64 ms  → ~2.3 ms
 *   throughput        2 178 / 2178 dec/sec → ~860 dec/sec
 *   p50               0.44 / 0.46 ms → ~1.0 ms
 *   p99               1.28 ms → ~3.9 ms
 *   max               2.82 ms → ~5.5 ms
 *   packages count    29/29 → 32
 *   tests passing     147 → 130
 *   languages count   12 langs → 13 non-English (plus English baseline)
 */

import { readFileSync, writeFileSync } from 'node:fs';

const REPLACEMENTS = [
  // Latency / throughput
  [/0\.64\s*ms/g, '~2.3 ms'],
  [/p95\s+0\.64/g, 'p95 ~2.3'],
  [/0\.44\s*ms/g, '~1.0 ms'],
  [/p50\s+0\.46/g, 'p50 ~1.0'],
  [/0\.46\s*ms/g, '~1.0 ms'],
  [/1\.28\s*ms/g, '~3.9 ms'],
  [/2\s*178\s*dec(?:isions)?(?:\/|\s+per\s+)sec/g, '~860 dec/sec'],
  [/2178\s*dec(?:isions)?(?:\/|\s+per\s+)sec/g, '~860 dec/sec'],
  [/2\s*178\s*\/sec/g, '~860 /sec'],
  // Multi-lang count
  [/12\s+non[- ]English\s+languages/g, '13 non-English languages'],
  [/12\s+languages\b/g, '13 non-English languages plus an English baseline'],
  [/across\s+12\s+languages/g, 'across 13 non-English languages plus an English baseline'],
];

const FILES = [
  '.github/launch/LINKEDIN.md',
  '.github/launch/MEDIUM_BLOG.md',
  '.github/launch/PRODUCT_HUNT.md',
  '.github/launch/REDDIT.md',
  '.github/launch/SHOW_HN.md',
  '.github/launch/TWITTER_THREAD.md',
  '.github/launch/DISCUSSION_WELCOME.md',
];

let totalChanges = 0;
for (const file of FILES) {
  try {
    const before = readFileSync(file, 'utf8');
    let after = before;
    for (const [re, sub] of REPLACEMENTS) {
      after = after.replace(re, sub);
    }
    if (after !== before) {
      writeFileSync(file, after);
      const changes = before.split('\n').filter((l, i) => l !== after.split('\n')[i]).length;
      console.log(`patched ${file} — ${changes} line(s)`);
      totalChanges += changes;
    }
  } catch (e) {
    console.error(`skipped ${file}: ${e.message}`);
  }
}
console.log(`\nTotal: ${totalChanges} line(s) changed across ${FILES.length} files.`);
