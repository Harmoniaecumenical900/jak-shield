#!/usr/bin/env node
/**
 * Prepare every @jak-shield/* workspace package for npm publishing.
 *
 *  - Removes `"private": true` (or sets it to false)
 *  - Adds publishConfig.access: public
 *  - Adds repository, bugs, homepage, license, keywords if missing
 *  - Adds a `files: [...]` allowlist so we only ship dist + README
 *  - Does NOT publish — that's a separate step (see publish-all.mjs)
 *
 * Run:  node scripts/prepare-npm-publish.mjs
 * Then: pnpm build && node scripts/publish-all.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const REPO = 'https://github.com/inbharatai/jak-shield';

const KEYWORDS_BASE = ['mcp', 'ai-safety', 'ai-security', 'prompt-injection', 'agent-security', 'jak-shield'];

// Per-package extra keywords (concatenated with base).
const PACKAGE_KEYWORDS = {
  '@jak-shield/dlp': ['pii-detection', 'dlp', 'gdpr', 'hipaa', 'pci-dss', 'redaction'],
  '@jak-shield/prompt-shield': ['llm-security', 'guardrails', 'jailbreak-detection', 'multilingual'],
  '@jak-shield/policy-engine': ['policy', 'rbac', 'taint-tracking', 'attack-chains', 'capability-tokens'],
  '@jak-shield/core': ['cryptography', 'hmac', 'aes-256-gcm', 'decision-signing'],
  '@jak-shield/audit-log': ['audit', 'compliance', 'logging'],
  '@jak-shield/approval-gateway': ['approval', 'human-in-the-loop', 'multi-tenant'],
  '@jak-shield/auth': ['auth', 'jwt', 'api-keys', 'rbac'],
  '@jak-shield/openai-classifier': ['openai', 'classifier', 'llm-judge'],
  '@jak-shield/observability': ['prometheus', 'metrics', 'rate-limit', 'circuit-breaker'],
  '@jak-shield/mcp-server': ['model-context-protocol', 'claude-desktop', 'cursor', 'openai-agents', 'security-gateway'],
};

// Description overrides per package (replaces whatever's there).
const DESCRIPTIONS = {
  '@jak-shield/shared': 'JAK Shield shared types and enums (UserRole, RiskLevel, DecisionAction, ComplianceTag) plus a tiny structured logger.',
  '@jak-shield/core': 'JAK Shield core: tamper-evident decision signing (HMAC-SHA256), AES-256-GCM field cipher, canonical-stable hashing, ID generators, error classes.',
  '@jak-shield/dlp': 'JAK Shield DLP: PII detection across 28 identifier types with cryptographic checksum validators (Luhn, Verhoeff, mod-97, ABA, mod-11, CPF, CNPJ, …) + secrets detection + persistence-time redaction.',
  '@jak-shield/prompt-shield': 'JAK Shield prompt-injection detector: 6 detection stages (standard, structural HTML/JSON, Unicode confusables, base64/hex/percent decode, spaced-letters, multilingual) across 13 non-English languages + English baseline.',
  '@jak-shield/policy-engine': 'JAK Shield policy engine: deterministic decide() pipeline, 8 built-in rules, RBAC, MinHash taint tracker, EWMA anomaly detector, 20 cross-call attack-chain patterns, capability tokens, regulatory-hint detector.',
  '@jak-shield/openai-classifier': 'JAK Shield OpenAI risk-classifier advisor (1.5s timeout, 60s cache, graceful degrade). Never overrides a deterministic block.',
  '@jak-shield/audit-log': 'JAK Shield audit logger with console + Prisma sinks. Auto-redacts PII before persistence.',
  '@jak-shield/approval-gateway': 'JAK Shield approval queue + Prisma schema. In-memory and Postgres-backed implementations.',
  '@jak-shield/auth': 'JAK Shield auth: bcrypt + JWT sessions, scoped API keys, team invitations, per-tenant AES-256-GCM credential vault.',
  '@jak-shield/observability': 'JAK Shield observability: in-process Prometheus metrics, token-bucket rate limiter, circuit breaker.',
  '@jak-shield/connectors-registry': 'JAK Shield connector registry — every protected tool registers here. Wraps execution with output sanitization + taint recording.',
  '@jak-shield/connectors-bundle': 'JAK Shield default connector bundle — registers all 13 built-in connectors.',
  '@jak-shield/mcp-server': 'JAK Shield MCP server (stdio + HTTP transports). Exposes 20 shield.* security tools + 24 protected connectors to any MCP-compatible client (Claude Desktop, OpenAI Agents SDK, Cursor, VS Code).',
};

async function main() {
  const pkgPaths = [];
  for await (const p of glob('packages/**/package.json', { cwd: ROOT })) {
    if (p.includes('node_modules')) continue;
    pkgPaths.push(path.join(ROOT, p));
  }

  let modified = 0;
  for (const p of pkgPaths) {
    const json = JSON.parse(readFileSync(p, 'utf8'));
    if (!json.name?.startsWith('@jak-shield/')) continue;

    delete json.private;
    json.version ??= '0.1.0';
    json.license ??= 'MIT';
    json.author ??= { name: 'JAK Shield', email: 'info@inbharat.ai' };
    json.repository = {
      type: 'git',
      url: 'git+' + REPO + '.git',
      directory: path.relative(ROOT, path.dirname(p)).replace(/\\/g, '/'),
    };
    json.bugs = { url: REPO + '/issues' };
    json.homepage = REPO + '#readme';
    json.publishConfig = { access: 'public' };
    json.engines ??= { node: '>=20.0.0' };
    if (DESCRIPTIONS[json.name]) json.description = DESCRIPTIONS[json.name];
    if (PACKAGE_KEYWORDS[json.name]) {
      json.keywords = [...new Set([...KEYWORDS_BASE, ...PACKAGE_KEYWORDS[json.name]])];
    } else if (!json.keywords) {
      json.keywords = KEYWORDS_BASE;
    }
    // Allow-list of what gets shipped — never ship src/, tests, tsbuildinfo.
    json.files = ['dist', 'README.md', 'LICENSE'];

    writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
    modified++;
    console.log(`prepared ${json.name}`);
  }
  console.log(`\n${modified} packages prepared for publish.`);
  console.log(`\nNext:\n  pnpm build\n  node scripts/publish-all.mjs   # publishes in dependency order`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
