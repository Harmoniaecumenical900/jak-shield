#!/usr/bin/env node
/**
 * Build a .mcpb (Model Context Protocol Bundle) for one-click install
 * into Claude Desktop. Bundles the JAK Shield MCP stdio entry plus its
 * runtime dependencies into a single zip archive following the spec at
 * https://www.anthropic.com/engineering/desktop-extensions
 *
 * Output: packaging/claude-desktop/jak-shield-<version>.mcpb
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BUILD_DIR = path.join(__dirname, 'build');
const SERVER_DIR = path.join(BUILD_DIR, 'server');
const MANIFEST_SRC = path.join(__dirname, 'manifest.json');
const MANIFEST_DST = path.join(BUILD_DIR, 'manifest.json');

function log(msg) {
  process.stdout.write(`[mcpb-build] ${msg}\n`);
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function main() {
  log('Cleaning build directory…');
  if (existsSync(BUILD_DIR)) rmSync(BUILD_DIR, { recursive: true, force: true });
  ensureDir(SERVER_DIR);

  log('Copying manifest…');
  copyFileSync(MANIFEST_SRC, MANIFEST_DST);

  log('Building MCP server bundle…');
  execSync('pnpm --filter @jak-shield/mcp-server... build', { cwd: ROOT, stdio: 'inherit' });

  log('Copying server output…');
  function cp(src, dst) {
    const stat = statSync(src);
    if (stat.isDirectory()) {
      ensureDir(dst);
      for (const entry of readdirSync(src)) cp(path.join(src, entry), path.join(dst, entry));
    } else {
      copyFileSync(src, dst);
    }
  }
  cp(path.join(ROOT, 'packages', 'mcp-server', 'dist'), SERVER_DIR);

  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'packages', 'mcp-server', 'package.json'), 'utf-8'));
  writeFileSync(path.join(BUILD_DIR, 'package.json'), JSON.stringify({
    name: 'jak-shield-mcpb',
    version: pkg.version,
    private: true,
    main: 'server/stdio.js',
    type: 'module',
    dependencies: pkg.dependencies,
  }, null, 2));

  // Zip the build dir into a .mcpb file (zip is the .mcpb format).
  const out = path.join(__dirname, `jak-shield-${pkg.version}.mcpb`);
  log(`Writing ${out}`);
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${BUILD_DIR}\\*' -DestinationPath '${out}' -Force"`);
  } else {
    execSync(`cd '${BUILD_DIR}' && zip -r '${out}' .`);
  }
  log('Done.');
}

main();
