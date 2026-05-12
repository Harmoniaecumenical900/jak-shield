# Contributing to JAK Shield

First — thank you. JAK Shield is built by people who care about AI agents not doing something stupid. You're one of them now.

## TL;DR

```bash
git clone https://github.com/inbharatai/jak-shield.git
cd jak-shield
pnpm install
pnpm build
pnpm test                # 147 unit + security tests
pnpm bench               # 45-scenario adversarial benchmark
node bench/perf-bench.mjs # p95 latency check (SLO 50ms)
```

If those four commands pass, you have a working dev environment. Open an issue and pick something tagged `good first issue`.

---

## Local development

### Requirements

- Node.js 20+
- pnpm 9.15.4+ (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- (Optional) Docker for the Postgres-backed full SaaS stack

### Run the dashboard locally

```bash
pnpm --filter @jak-shield/api dev       # http://localhost:4100
pnpm --filter @jak-shield/dashboard dev # http://localhost:3000
pnpm --filter @jak-shield/mcp-server dev:http # http://localhost:4101/mcp
```

### Run the MCP server as a Claude Desktop extension

```bash
node scripts/install-claude-desktop-mcp.mjs
# Then quit + reopen Claude Desktop
```

---

## What we love receiving

Listed in rough order of leverage. All come with credit in [`HALL_OF_FAME.md`](./HALL_OF_FAME.md).

1. **New adversarial benchmark scenarios.** Add to `bench/scenarios.json`. Any novel attack we can detect is a win; any novel attack we *miss* is even more valuable (file as a bug, we'll fix and credit you).
2. **New PII type with a checksum validator.** Add to `packages/dlp/src/validators.ts` + a layer in `pii-detector-v2.ts` + 5+ tests.
3. **New language for injection detection.** Add patterns to `packages/prompt-shield/src/patterns-extended.ts` — native-speaker review highly preferred.
4. **New attack-chain pattern.** Add to `packages/policy-engine/src/attack-chains.ts` with a real-world reference.
5. **New protected connector.** Copy `packages/connectors/_template/`, wire it into `bundle/`, add credential requirements to `apps/api/src/connector-requirements.ts`.
6. **Documentation, tutorials, screencasts.** Drop into `docs/` or YouTube and we'll link from the README.
7. **Translations of the dashboard.** Help us reach more developers.

## What we will NOT merge

- Code that lowers the test count without a written justification.
- Changes that silently break decision-signature canonicalization (these have a regression test — see `packages/core/src/__tests__/sign-decision.test.ts`).
- Pattern additions that lack a corresponding test scenario in `bench/scenarios.json`.
- Anything that adds an `as never` / `as any` cast without a comment explaining why.
- Connectors that bypass the policy engine.
- Anything that removes the explicit compliance disclaimer from regulatory hints.

---

## Filing a bug

Use [`.github/ISSUE_TEMPLATE/bug_report.md`](./.github/ISSUE_TEMPLATE/bug_report.md). Include:

- JAK Shield version (`git rev-parse HEAD`)
- MCP client (Claude Desktop / Cursor / VS Code / Agents SDK / curl)
- Minimal reproducer (a single `shield_evaluate_tool_call` request that misbehaves)
- Expected vs actual

## Reporting a security vulnerability

**Do not** open a public GitHub issue. Email **security@jakshield.ai** and follow [`SECURITY.md`](./SECURITY.md).

---

## Pull-request checklist

- [ ] All 147 existing tests still pass (`pnpm -r --filter '!@jak-shield/dashboard' test`)
- [ ] Adversarial bench still 45/45 (`pnpm bench`)
- [ ] Perf SLO still under 50ms p95 (`node bench/perf-bench.mjs`)
- [ ] New code paths covered by at least one test
- [ ] Public APIs have JSDoc
- [ ] No new `as any` / `as never` casts (the lint config blocks them)
- [ ] `pnpm typecheck` clean
- [ ] If you added a new detector: a labelled scenario in `bench/scenarios.json`
- [ ] If you changed `decide()` order: a paragraph in the PR description explaining why
- [ ] If you added a new shield MCP tool: documented in `README.md` + tested

---

## Code style

- TypeScript strict mode, `noUncheckedIndexedAccess`, no implicit any.
- 2-space indent.
- Single quotes.
- Trailing commas in multiline.
- File-level JSDoc on every detector / module.
- We don't bikeshed — Prettier defaults are fine.

---

## Code of conduct

Read [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Be excellent.

---

## Release process (maintainers only)

1. `pnpm version <major|minor|patch>` at root.
2. Update `CHANGELOG.md`.
3. `git tag v0.x.0 && git push --tags`.
4. CI publishes to npm and builds the `.mcpb` bundle for Claude Desktop.
5. Announce on Discord + Twitter with hashtags `#MCP #AISafety #JAKShield`.
