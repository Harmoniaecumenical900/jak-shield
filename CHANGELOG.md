# Changelog

All notable changes to JAK Shield are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); JAK Shield adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Block override + heightened scrutiny (the headline feature)

The hardest design call in any guardrail system is: what happens when the
guardrail is wrong? Hard-blocking everything makes the agent unusable in edge
cases. Auto-allowing everything makes the guardrail decorative. JAK Shield's
answer:

- Every BLOCK decision now carries an **override offer** that says, in plain
  English, what's being blocked, why, and what the worst case is if the block
  was correct.
- The user can **accept the risk** via `shield.override_block` with a written
  reason (≥ 8 chars, audit-logged) and their user id.
- Acceptance mints a **single-use, HMAC-signed override token** AND opens a
  **heightened-scrutiny window** for the next 5–10 calls (or 15 minutes) on
  that session.
- Inside the window: anomaly z-score threshold drops 3.0 → 1.5, taint
  Jaccard threshold drops 0.30 → 0.15, and **any further block is not
  overridable** (one-strike rule).
- **CRITICAL-class blocks are never overridable.** This includes `rm -rf /`,
  `DROP TABLE` without `WHERE`, `mkfs`, prod-deploy without ticket, payment
  without idempotency, capability-token replay, capability-token tamper, and
  the offensive-cyber rule family. The user has to change the request, not
  the verdict.
- Override fields are included in the signed canonical form — tampering with
  `overridable` (e.g. trying to forge an override offer onto a CRITICAL
  block) invalidates the HMAC at verification.

New code:

- `packages/shared/src/types.ts` — `BlockOverrideOffer`,
  `HeightenedScrutinyState`, `ScrutinyWarning`
- `packages/policy-engine/src/block-override.ts` — offer builder + never-list
- `packages/policy-engine/src/heightened-scrutiny.ts` — session state, TTL,
  thresholds, tick/warn/end
- `packages/policy-engine/src/accept-override.ts` — verifies signature, mints
  token, opens scrutiny, returns audit note
- `packages/mcp-server/src/shield-tools.ts` — three new MCP tools:
  `shield.override_block`, `shield.scrutiny_status`, `shield.stand_down`
- 17 new tests in
  `packages/policy-engine/src/__tests__/override-and-scrutiny.test.ts`
  covering: CRITICAL non-override, never-list rules, valid offer shape,
  signature tampering detection (including forging an offer onto a
  CRITICAL block), scrutiny window ticking, second-block-during-scrutiny
  refusal, manual stand-down.

### Fixed — Signature canonicalization bug

`canonical()` in `packages/core/src/sign-decision.ts` previously used
`JSON.stringify(obj, Object.keys(obj).sort())`. That form uses the array as
a **recursive selector** — at every nesting level — so when the new
`override` field was added to the canonical, its nested keys (which weren't
in the top-level array) got silently stripped from the signed payload.

Net effect: an attacker could mutate `decision.override.overridable` from
`false` to `true` and the HMAC would still validate. Caught by the new
override-tampering test. Replaced the array-selector with a manual
`stableStringify()` that recurses through objects and arrays, sorting keys
at every level. The original simpler tests still pass because they don't
exercise nested signed fields, but every new field added to canonical from
here forward is actually tamper-evident.

### Added

- **OpenAPI 3.1 adapter** (`packages/adapters/openapi/`) — drop-in spec for
  ChatGPT Custom GPTs and the OpenAI Actions ecosystem. Six operations:
  evaluate, scan, redact, compliance-tag, sanitize-output, list-protected.
- **LangChain adapter** in both Python (`packages/adapters/langchain/python/`)
  and TypeScript (`packages/adapters/langchain/js/`). Four `BaseTool` /
  `DynamicStructuredTool` instances plus a `gate()` wrapper that takes an
  existing tool and returns its gated equivalent.
- **Gemini adapter** (`packages/adapters/gemini/`) — `FunctionDeclaration[]`
  compatible with `@google/genai`, plus `handleFunctionCall()` dispatcher and
  `gate()` wrapper.
- **CrewAI adapter** (`packages/adapters/crewai/`) — native CrewAI 0.80+
  `BaseTool` subclasses; synchronous `httpx.Client` to match CrewAI's
  execution model.
- **Vercel AI SDK adapter** (`packages/adapters/vercel-ai/`) — Vercel AI SDK
  v4+ `tool()` definitions with Zod schemas, Edge-runtime ready via custom
  `fetchImpl`.
- **Pydantic AI adapter** (`packages/adapters/pydantic-ai/`) — async-first
  Python adapter using `httpx.AsyncClient`. `register_jak_shield_tools(agent,
  shield)` registers all four tools onto a Pydantic AI Agent in one call.
- REST endpoints `POST /api/evaluate/scan`, `/redact`, `/compliance-tag`,
  `/sanitize-output` on `apps/api` — the adapters above depend on these.
- `MANUAL_LAUNCH.md` — copy-paste blocks for the public-facing launch steps
  (Discussion post, awesome-mcp-servers PR, Smithery submit, npm publish)
  the sandbox correctly blocks the agent from doing under the user's
  identity.
- `scripts/fix-perf-claims.mjs` — one-shot updater that batch-replaces stale
  perf numbers across launch materials when a new measurement is taken.

### Changed

- **Performance numbers corrected across the project.** Three back-to-back
  runs of `bench/perf-bench.mjs` on the current dev machine give:
  - p50 ~1.0 ms, p95 ~2.3 ms, p99 ~3.9 ms, max ~5.5 ms
  - ~860 decisions/sec
  - measured end-to-end through MCP stdio (JSON serialization + transport
    + policy pipeline + signing)

  Previous README copy claimed **p95 0.64 ms**, **2 178 dec/sec**, **p50
  0.44 ms** — those numbers were from a prior environment and did not
  reproduce. Corrected in `README.md`, `.github/launch/*.md`,
  `.github/launch/DISCUSSION_WELCOME.md`. The 50 ms SLO margin therefore
  drops from "77×" to "~21×" — still well within tolerance, just honest.
- **Test count corrected** from "147 tests" to "130 tests" — the actual
  passing count on the live `pnpm -r test` run after the adapter additions.
  Touched README badge, perf-table row, three launch drafts.
- **Package count corrected** from "29/29" to "32" packages — the adapter
  additions bumped the workspace count. Touched README perf table.
- **Multilingual count clarified** from "12 languages" to "13 non-English
  languages plus an English baseline" — confirmed by grep on
  `packages/prompt-shield/src/patterns-extended.ts`. Touched README diagram,
  comparison table, pattern-file header, and three launch drafts.
- `packages/{shared,approval-gateway,audit-log,connectors/registry,openai-classifier}`
  test scripts now pass `--passWithNoTests` so `pnpm -r test` doesn't fail
  on packages without tests yet.

### Fixed

- `evaluate.ts` REQUIRES_APPROVAL branch: was mutating `approvalId` after
  HMAC signing, causing the wire payload to fail signature verification on
  the client side. Now re-signs the decision with the approval ID baked in.
  Regression test in `packages/core/src/__tests__/sign-decision.test.ts`.

### Verified locally

- `pnpm -r build` — clean, 32 packages.
- `pnpm -r test` — **164 tests passing** (previously 130; added 17
  override-and-scrutiny + 17 from other suites that landed on this branch).
- `pnpm bench` — 45/45 adversarial scenarios, 0 failures.
- `bench/perf-bench.mjs` × 3 — perf numbers above are stable across runs.

## [0.1.0] — 2026-05-11

Initial public release.

### Added

- **MCP server** with stdio + HTTP transports, exposing 20 `shield.*` tools and 24 protected connectors.
- **Deterministic policy engine** with 8 built-in rules (dangerous shell, dangerous SQL, external-email PII, prod-deploy, payments, social-publish, fs sandbox, browser denylist) and a 10-stage decision pipeline.
- **PII detector v2** — 28 PII types with cryptographic checksum validators (Luhn, Verhoeff, mod-97, ABA, mod-11, CPF/CNPJ, SIN, NRIC, TFN, EIN, IMEI, Bitcoin, Ethereum, IPv6, MAC).
- **Injection detector v2** — 6 stages (standard regex, structural HTML/JSON, Unicode confusables, base64/hex/percent decode, spaced-letter de-spacing, multilingual) with 80+ patterns across 13 non-English languages plus English (EN, ES, FR, DE, IT, PT, RU, ZH, JA, KO, HI, AR, TR, VI).
- **Taint tracker** — MinHash + n-gram fingerprinting, per-session, blocks UNTRUSTED data flowing into sensitive sinks (novel for MCP).
- **Attack-chain detector** — 20 multi-step patterns with data-flow tracking and time-decay weighting.
- **Anomaly detector** — EWMA + z-score, multi-window (1m/5m/1h/24h), per-tenant + per-agent baselines.
- **Capability tokens** — short-lived (60s default), single-use, scope-bound JWTs with HMAC verification + burn-list.
- **Tamper-evident decisions** — HMAC-SHA256 signatures with key-rotation support.
- **Regulatory hints** — PCI DSS, HIPAA, GDPR, CCPA, SOX, FERPA, DPDP signal detection with CFR / GDPR article citations and explicit disclaimers.
- **Observability** — in-process Prometheus metrics (15+ counters/gauges/histograms), `/metrics` endpoint, token-bucket rate limiter, circuit breaker.
- **SaaS foundation** — Multi-tenant data model, password + JWT auth, API keys with scopes, team invitations, encrypted credential vault, billing scaffolding with usage counters.
- **Dashboard** — Next.js 15 with approvals, audit search, analytics, team, API keys, credentials, billing pages.
- **CI workflow** — GitHub Actions that build + test + bench + perf-check on every push.
- **Adversarial benchmark** — 45 labeled scenarios across 25 attack categories.
- **Performance** — at release time the bench measured ~1 742 decisions/sec, p95 0.64 ms; on the current dev machine post-adapter-additions it measures ~860 dec/sec, p95 ~2.3 ms end-to-end through MCP stdio. Both runs stayed well inside the 50 ms p95 SLO.
- **`.mcpb` packaging** for one-click Claude Desktop install.
- **Architecture docs**, **deployment docs** (Render / Fly / Vercel / Docker / k8s), **honest self-audit**.

### Security

- Boot-time refusal in `NODE_ENV=production` if dev secrets detected.
- AES-256-GCM at-rest encryption for connector credentials.
- All audit-log writes auto-redact PII before persistence.
- Filesystem connector is sandboxed; shell connector is allowlist-gated.

### Known limitations (open-source release)

- No SOC 2, no external pen-test, no customer reference yet.
- PII detectors are regex+checksum based; an ML-trained classifier is on the Q2 2026 roadmap.
- Injection detectors are rule-based; ML augmentation is on the Q2 2026 roadmap.
- Taint tracking is in-memory single-process; multi-instance persistence is on the roadmap.

[Unreleased]: https://github.com/inbharatai/jak-shield/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/inbharatai/jak-shield/releases/tag/v0.1.0
