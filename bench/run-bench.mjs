#!/usr/bin/env node
/**
 * Adversarial benchmark runner. Loads bench/scenarios.json, fires each
 * through the live MCP stdio server, and emits precision/recall + a
 * per-category breakdown.
 *
 * Usage:
 *   pnpm bench                 # run with current detectors
 *   pnpm bench -- --json out.json   # also write JSON
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STDIO = path.resolve(__dirname, '..', 'packages', 'mcp-server', 'dist', 'stdio.js');
const SCENARIOS = JSON.parse(readFileSync(path.join(__dirname, 'scenarios.json'), 'utf8')).scenarios;

const args = process.argv.slice(2);
const jsonOutIdx = args.indexOf('--json');
const jsonOut = jsonOutIdx >= 0 ? args[jsonOutIdx + 1] : null;

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [STDIO],
    env: {
      ...process.env,
      SHIELD_AUTH_OPTIONAL: '1',
      SHIELD_DEFAULT_TENANT_ID: 'bench',
      SHIELD_DEFAULT_USER_ROLE: 'TENANT_ADMIN',
      SHIELD_CORPORATE_DOMAINS: 'corp.com',
      LOG_LEVEL: 'error',
    },
  });
  const client = new Client({ name: 'jak-shield-bench', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);

  const results = [];
  for (const s of SCENARIOS) {
    const ctx = s.role ? { role: s.role, tenantId: `bench-${s.id}` } : { tenantId: `bench-${s.id}` };
    const r = await client.callTool({
      name: 'shield.evaluate_tool_call',
      arguments: { tool_name: s.tool, args: s.args, context: ctx },
    });
    const text = r.content?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text);
    const got = parsed.action;
    const gotRule = parsed.rule;
    const okAction = got === s.expect.action;
    const okRule = !s.expect.rule || gotRule === s.expect.rule;
    const pass = okAction && okRule;
    results.push({
      id: s.id,
      category: s.category,
      expected: s.expect.action + (s.expect.rule ? ` (${s.expect.rule})` : ''),
      got: got + (gotRule ? ` (${gotRule})` : ''),
      pass,
      evidence: parsed.provenance?.evidence?.length ?? 0,
      compliance: parsed.compliance ?? [],
    });
  }

  await client.close();

  // ---- Summary ----
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const byCat = new Map();
  for (const r of results) {
    const cat = byCat.get(r.category) ?? { pass: 0, total: 0 };
    cat.total++;
    if (r.pass) cat.pass++;
    byCat.set(r.category, cat);
  }

  console.log('\n========== JAK SHIELD BENCHMARK ==========\n');
  console.log(`Overall: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)\n`);
  console.log('By category:');
  for (const [cat, s] of [...byCat.entries()].sort()) {
    const pct = ((s.pass / s.total) * 100).toFixed(0).padStart(3);
    const bar = '█'.repeat(Math.round((s.pass / s.total) * 20)).padEnd(20, '░');
    console.log(`  ${pct}%  ${bar}  ${cat.padEnd(26)} ${s.pass}/${s.total}`);
  }

  console.log('\nFailures:');
  const fails = results.filter((r) => !r.pass);
  if (fails.length === 0) console.log('  (none)');
  else for (const f of fails) console.log(`  ${f.id} (${f.category}): expected ${f.expected}, got ${f.got}`);

  console.log('\nEvidence depth (avg evidence items per decision):');
  const avgEvidence = results.reduce((a, r) => a + r.evidence, 0) / results.length;
  console.log(`  ${avgEvidence.toFixed(1)}`);

  // Compliance tag frequency
  const tagFreq = new Map();
  for (const r of results) for (const t of r.compliance) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
  if (tagFreq.size > 0) {
    console.log('\nCompliance tags emitted:');
    for (const [t, n] of [...tagFreq.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${t}: ${n}`);
    }
  }

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({ summary: { passed, total }, results }, null, 2));
    console.log(`\nWrote ${jsonOut}`);
  }

  if (passed < total) process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
