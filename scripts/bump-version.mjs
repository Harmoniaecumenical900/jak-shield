#!/usr/bin/env node
/**
 * Bump version in every workspace package.json + pyproject.toml.
 *
 * Usage:
 *   node scripts/bump-version.mjs 0.3.0
 *   node scripts/bump-version.mjs 0.3.0 --dry-run
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const NEW_VERSION = args.find((a) => /^\d+\.\d+\.\d+/.test(a));
const DRY_RUN = args.includes('--dry-run');

if (!NEW_VERSION) {
  console.error('Usage: node scripts/bump-version.mjs <version> [--dry-run]');
  console.error('Example: node scripts/bump-version.mjs 0.3.0');
  process.exit(1);
}

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'awesome-mcp-servers']);

function walk(dir, hits = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    try {
      const s = statSync(p);
      if (s.isDirectory()) walk(p, hits);
      else if (name === 'package.json' || name === 'pyproject.toml') hits.push(p);
    } catch { /* ignore */ }
  }
  return hits;
}

const files = walk(REPO_ROOT);
let changed = 0;

for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let after = before;
  if (f.endsWith('package.json')) {
    // Single quoted version key. We only touch the package's own version,
    // NOT dependency version strings like ^0.1.0.
    const pkg = JSON.parse(before);
    if (pkg.version && pkg.version !== NEW_VERSION) {
      pkg.version = NEW_VERSION;
      after = JSON.stringify(pkg, null, 2) + '\n';
    }
  } else if (f.endsWith('pyproject.toml')) {
    after = before.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${NEW_VERSION}"`);
  }
  if (before !== after) {
    console.log(`${DRY_RUN ? '(dry) ' : ''}${f.replace(REPO_ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/')}`);
    if (!DRY_RUN) writeFileSync(f, after);
    changed += 1;
  }
}

console.log(`\n${DRY_RUN ? '(dry) Would bump' : 'Bumped'} ${changed} file(s) to ${NEW_VERSION}.`);
