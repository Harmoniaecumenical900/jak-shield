#!/usr/bin/env node
/**
 * Update contact info across the repo to current authoritative values.
 *
 * Source of truth (provided by user on 2026-05-13):
 *   - email:     info@inbharat.ai          (was hello@jakshield.ai, security@jakshield.ai)
 *   - X/Twitter: reetur_aj                  (was jakshield)
 *   - Instagram: unigurus                   (new — not previously in repo)
 *   - Discord:   reetur_aj                  (handle, no server — was discord.gg/jakshield)
 *   - Reddit:    reetur_aj                  (was r/jakshield subreddit reference)
 *
 * Run:
 *   node scripts/update-contact-info.mjs --dry-run    # preview
 *   node scripts/update-contact-info.mjs              # apply
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY_RUN = process.argv.includes('--dry-run');
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..');

const SUBS = [
  // Emails — both old emails collapse to one new address.
  { re: /hello@jakshield\.ai/g, to: 'info@inbharat.ai' },
  { re: /security@jakshield\.ai/g, to: 'info@inbharat.ai' },

  // X / Twitter handle
  { re: /twitter\.com\/jakshield(?![\w-])/g, to: 'twitter.com/reetur_aj' },
  { re: /x\.com\/jakshield(?![\w-])/g, to: 'x.com/reetur_aj' },
  { re: /follow-@jakshield/g, to: 'follow-@reetur_aj' },
  { re: /@jakshield(?![\w-.])/g, to: '@reetur_aj' },

  // Reddit — subreddit didn't exist; redirect to user profile
  { re: /reddit\.com\/r\/jakshield(?![\w-])/g, to: 'reddit.com/user/reetur_aj' },
  { re: /\br\/jakshield(?!\w)/g, to: 'u/reetur_aj' },

  // YouTube channel didn't exist either — point at GitHub releases
  { re: /youtube\.com\/@jakshield(?![\w-])/g, to: 'github.com/inbharatai/jak-shield/releases' },

  // LinkedIn company didn't exist — point at personal profile (best-guess; user can correct)
  { re: /linkedin\.com\/company\/jakshield(?![\w-])/g, to: 'linkedin.com/in/reetur-aj' },

  // Discord — no public server yet. Old badge linked to discord.gg/jakshield (404).
  // Point the badge URL at the repo's Discussions tab where users can actually
  // reach the maintainer. The visible handle stays "reetur_aj" in the
  // Community section text so people can DM directly.
  { re: /discord\.gg\/jakshield(?![\w-])/g, to: 'github.com/inbharatai/jak-shield/discussions' },

  // Blog didn't exist either
  { re: /https:\/\/jakshield\.ai\/blog/g, to: 'https://github.com/inbharatai/jak-shield/discussions/categories/announcements' },
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'awesome-mcp-servers']);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json']);
const TEXT_EXTS = new Set(['.md', '.json', '.yml', '.yaml', '.toml', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.html', '.txt', '.sh']);

function walk(dir, hits = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.git')) continue;
    if (SKIP_FILES.has(name)) continue;
    const p = join(dir, name);
    try {
      const s = statSync(p);
      if (s.isDirectory()) {
        walk(p, hits);
      } else if (TEXT_EXTS.has(extname(name))) {
        hits.push(p);
      }
    } catch { /* ignore */ }
  }
  return hits;
}

const SELF_PATH = fileURLToPath(import.meta.url);
const files = walk(REPO_ROOT).filter((f) => f !== SELF_PATH);
let totalChanges = 0;
let filesChanged = 0;

for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let after = before;
  for (const { re, to } of SUBS) after = after.replace(re, to);
  if (before !== after) {
    const delta = before.split('\n').filter((l, i) => l !== after.split('\n')[i]).length;
    console.log(`${DRY_RUN ? '(dry) ' : ''}${f.replace(REPO_ROOT + '/', '').replace(/\\/g, '/')} — ${delta} line(s)`);
    if (!DRY_RUN) writeFileSync(f, after);
    filesChanged += 1;
    totalChanges += delta;
  }
}

console.log(`\n${DRY_RUN ? '(dry) Would change' : 'Changed'} ${totalChanges} line(s) across ${filesChanged} file(s).`);
