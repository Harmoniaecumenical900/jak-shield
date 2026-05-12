#!/usr/bin/env node
/**
 * Publish all @jak-shield/* packages to npm in dependency order.
 *
 * Prerequisites:
 *  1. Run scripts/prepare-npm-publish.mjs first
 *  2. `pnpm build` (so dist/ exists for every package)
 *  3. `npm login` (or NPM_TOKEN in env for CI)
 *  4. Own the @jak-shield scope on npm (npm.com → orgs → create)
 *
 * Run:  node scripts/publish-all.mjs [--dry-run]
 *
 * The script walks workspace packages, computes the dependency DAG, and
 * publishes leaves first. Skips a package if its current version is already
 * on the registry.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

async function loadPackages() {
  const packages = new Map(); // name → { dir, manifest, deps }
  for await (const p of glob('packages/**/package.json', { cwd: ROOT })) {
    if (p.includes('node_modules')) continue;
    const full = path.join(ROOT, p);
    const manifest = JSON.parse(readFileSync(full, 'utf8'));
    if (!manifest.name?.startsWith('@jak-shield/') || manifest.private) continue;
    const deps = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ].filter((d) => d.startsWith('@jak-shield/')));
    packages.set(manifest.name, { dir: path.dirname(full), manifest, deps });
  }
  return packages;
}

function topoSort(packages) {
  const order = [];
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const pkg = packages.get(name);
    if (!pkg) return;
    for (const dep of pkg.deps) visit(dep);
    order.push(name);
  }
  for (const name of packages.keys()) visit(name);
  return order;
}

function alreadyPublished(name, version) {
  try {
    const out = execSync(`npm view ${name} version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() === version;
  } catch {
    return false; // not on registry yet
  }
}

async function main() {
  const packages = await loadPackages();
  const order = topoSort(packages);
  console.log(`Publishing ${order.length} packages in dependency order:\n  ${order.join('\n  ')}\n`);

  let published = 0;
  let skipped = 0;
  for (const name of order) {
    const pkg = packages.get(name);
    const version = pkg.manifest.version;
    if (alreadyPublished(name, version)) {
      console.log(`  SKIP ${name}@${version} (already on registry)`);
      skipped++;
      continue;
    }
    console.log(`  PUBLISH ${name}@${version}${DRY_RUN ? ' (--dry-run)' : ''}`);
    const cmd = `pnpm publish --no-git-checks${DRY_RUN ? ' --dry-run' : ''}`;
    execSync(cmd, { cwd: pkg.dir, stdio: 'inherit' });
    published++;
  }
  console.log(`\nDone: ${published} published, ${skipped} skipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
