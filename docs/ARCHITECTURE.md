# JAK Shield architecture

This document describes the runtime model, package layout, decision pipeline, and operational guarantees. It is the source of truth for *what the engine does* — when in doubt, this document, not marketing copy.

---

## 1. Runtime model

JAK Shield is an **MCP-native security gateway**. Every AI tool call crosses it before reaching the real connector.

```
┌─────────────────────────┐    MCP stdio / HTTP    ┌──────────────────────────┐
│  AI Client              │ ────────────────────►  │  JAK Shield MCP server   │
│  (Claude, OpenAI, etc.) │                        │  (stdio.ts / http.ts)    │
└─────────────────────────┘                        └────────────┬─────────────┘
                                                                │
                                                                ▼
                                                ┌───────────────────────────────┐
                                                │  evaluateAndMaybeExecute()    │
                                                │  packages/mcp-server          │
                                                └───────────────┬───────────────┘
                                                                │
                ┌───────────────────────────────────────────────┼───────────────────────────────┐
                ▼                                                ▼                               ▼
┌─────────────────────────────┐         ┌─────────────────────────────────────┐    ┌──────────────────────────┐
│  decide()                   │         │  OpenAI classifier (advisory)       │    │  Connector registry      │
│  packages/policy-engine     │         │  packages/openai-classifier         │    │  packages/connectors/*   │
└─────────────────────────────┘         └─────────────────────────────────────┘    └──────────────────────────┘
       │ pipeline (see §3)
       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  evidence tree → HMAC-signed PolicyDecision  →  audit log (Prisma)  → metrics counters (Prometheus)         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Package layout

| Package | Responsibility |
|---|---|
| `@jak-shield/shared` | Enums (`UserRole`, `RiskLevel`, `DecisionAction`, `ComplianceTag`), types, logger. Zero dependencies. |
| `@jak-shield/core` | Tamper-evident decision signing, error classes, canonical JSON, AES-256-GCM field cipher, `assertSigningSecretReady()`. |
| `@jak-shield/dlp` | PII detector v2 (28 types incl. SSN, Aadhaar, CPF, NRIC, IBAN, IMEI, crypto wallets), checksum validators (Luhn, Verhoeff, mod-97, ABA, mod-11), secrets detector, persistence redactor. |
| `@jak-shield/prompt-shield` | Injection detector v2 (6 stages: standard, structural, unicode, encoding, spaced, multilingual). 80+ patterns across 13 non-English languages plus English + RAG poisoning + tool-name spoof + indirect injection + format-token attacks. |
| `@jak-shield/policy-engine` | `decide()` orchestrator, deterministic rule set, RBAC, taint tracker (MinHash + n-gram), anomaly detector (EWMA + z-score + multi-window), attack-chain detector (20 patterns + data-flow), capability tokens, compliance signal detector. |
| `@jak-shield/openai-classifier` | Optional OpenAI risk classifier with 1.5s timeout, 60s decision cache, graceful degrade. Advisory only — never overrides a hard block. |
| `@jak-shield/audit-log` | Audit logger with console + Prisma sinks. Auto-redacts PII before writing. |
| `@jak-shield/approval-gateway` | Prisma schema + in-memory and Postgres approval queues. |
| `@jak-shield/auth` | Signup/login, JWT cookies, API keys (sha256-hashed), invitations, per-tenant encrypted credential vault. |
| `@jak-shield/observability` | In-process Prometheus metrics, token-bucket rate limiter, circuit breaker. |
| `@jak-shield/connectors-*` | 13 protected connectors (filesystem, shell, gmail, github, supabase, postgres, browser, http, slack, sms, gdrive, webhook, social). |
| `@jak-shield/mcp-server` | MCP stdio + HTTP transports, 20 `shield.*` tools, `evaluateAndMaybeExecute()`, per-tenant context propagation via AsyncLocalStorage. |
| `apps/api` | Fastify backend — REST API for dashboard, `/metrics` Prometheus endpoint, structured request logging, rate limiting, graceful shutdown. |
| `apps/dashboard` | Next.js 15 dashboard — auth, approvals, audit search, analytics, team, API keys, credentials, billing. |
| `apps/demo-agent` | Reference MCP client + scenario test runner. |
| `bench/` | 45-scenario adversarial benchmark + perf benchmark (p50/p95/p99 + SLO guard at 50ms p95). |

---

## 3. Decision pipeline

For each tool call, `decide()` runs the stages below **in order**. Each stage may short-circuit; if it doesn't, evidence accumulates and the next stage runs. Every emitted decision carries the full evidence tree and an HMAC signature.

1. **Track call** — record per-tenant + per-agent counters; record session-call for chain detection.
2. **Hard rules** — `dangerous-shell`, `dangerous-sql` (DROP/TRUNCATE/ALTER USER). Any block short-circuits.
3. **Input scan: injection** — 6-stage detector. HIGH-risk findings short-circuit to BLOCK.
4. **Input scan: offensive cyber** — heuristic for malware-creation / credential-theft / DDoS / evasion. Down-weighted by defensive markers.
5. **Taint check** — if any args field MinHash-matches (Jaccard ≥ 0.30) a prior UNTRUSTED tool output AND the current tool is a sensitive sink → require approval.
6. **Cross-call attack-chain** — match recent tool-call sequence against 20 patterns; if matched, evaluate data-flow boost (output of step N appears in args of step N+1) and time-decay (5-min window), emit approval.
7. **Soft rules** — `external-email-pii`, `production-deploy`, `payment`, `social-publish`, `filesystem-sandbox`, `browser-scrape`. Any return short-circuits.
8. **PII / secrets scan** — multi-validator detector. Findings → REDACT decision with redacted args + compliance tags.
9. **Anomaly** — burst (5/60s for destructive, 20/60s otherwise) + first-seen-destructive + z-score ≥ 3σ vs EWMA baseline.
10. **RBAC** — role × risk-class table.
11. **Approval threshold** — risk class vs configured threshold (default HIGH).
12. **Allow** — base decision.
13. **Classifier upgrade** — if OpenAI classifier says risk ≥ 0.85 + suggests BLOCK, escalate. If ≥ 0.6 + currently ALLOW, escalate to approval.

Every decision is then **HMAC-signed** with `JAK_SHIELD_DECISION_HMAC`. The signature covers a canonicalized projection of the decision (action, risk, reason, rule, evidence summaries). Downstream consumers (audit log, dashboard) call `verifyDecisionSignature()` to detect tampering.

---

## 4. Compliance hints — explicit honesty

`packages/policy-engine/src/compliance.ts` emits regulatory **hints**, not legal classifications.

- Each hint carries a confidence (0..1) and a citation (CFR section, GDPR article).
- Every response includes a disclaimer stating the hints are triage signals.
- Hints do NOT certify Covered Entity status (HIPAA), lawful basis (GDPR), or CDE scope (PCI DSS).
- A compliance officer is required to confirm scope.

---

## 5. Operational guarantees

| Guarantee | Mechanism |
|---|---|
| Decision latency p95 < 50 ms | `bench/perf-bench.mjs` runs in CI; 1000-iter sample on stock CPU; SLO violation fails the build. |
| Tamper-evident audit | HMAC-SHA256 over canonical decision + key rotation support (`JAK_SHIELD_DECISION_HMAC_PREVIOUS`). |
| Production secrets present | `assertSigningSecretReady()` throws at boot if `NODE_ENV=production` + default dev secret detected. |
| Per-tenant credential isolation | AES-256-GCM at-rest encryption + per-tool env materialization with restoration. |
| Per-tenant API key authentication | sha256-hashed, scope-gated, last-used tracked, revocable. |
| Per-tenant rate limiting | Token-bucket (60 req/min default, 10 req/min on auth endpoints). |
| Connector failure isolation | Circuit breaker (5 failures → 30 s open). |
| Graceful shutdown | SIGTERM/SIGINT handlers drain Fastify before exit. |
| Multi-tenant routing on MCP HTTP | `/mcp/<tenantId>` + API-key auth; AsyncLocalStorage propagates context. |

---

## 6. Observability

`/metrics` on the API server exposes Prometheus counters/gauges/histograms:

- `jak_shield_decisions_total{action,rule}`
- `jak_shield_decision_latency_ms` (histogram)
- `jak_shield_connector_calls_total{tool,outcome}`
- `jak_shield_classifier_calls_total{outcome}`
- `jak_shield_classifier_latency_ms`
- `jak_shield_approvals_total{status}`
- `jak_shield_pii_findings_total{type}`
- `jak_shield_injection_detected_total{stage}`
- `jak_shield_taint_flow_total{kind}`
- `jak_shield_attack_chains_total{}`
- `jak_shield_anomalies_total{}`
- `jak_shield_rate_limited_total{route}`
- `jak_shield_http_requests_total{method,route,status}`
- `jak_shield_active_approvals` (gauge)

Recommended alerts (Prometheus rules):
- `rate(jak_shield_decisions_total{action="block"}[5m]) > 0.5` — spike in blocks
- `histogram_quantile(0.95, rate(jak_shield_decision_latency_ms_bucket[5m])) > 50` — p95 SLO breach
- `jak_shield_active_approvals > 100` — approval queue backlog

---

## 7. Threat model — what JAK Shield defends, and what it doesn't

**Defends against**
- Agent over-reach: an AI agent asked to send an email externally with PII gets gated.
- Prompt injection in tool input (regex + Unicode confusables + encoding decode + structural HTML/JSON + multilingual).
- Prompt injection in tool output (sanitization wrapper).
- Destructive SQL / shell / filesystem operations.
- Credential exfiltration via tool-call chains (read .env → POST webhook).
- Sudden behavior change (anomaly bursts, first-seen destructive tools).
- Untrusted browser content flowing into sensitive sinks (taint).
- Spoofed tool calls (RBAC + capability tokens).

**Does NOT defend against**
- A compromised JAK Shield deployment (operator-level threat).
- Trained-in model misalignment (we don't control the model).
- Side channels (timing, embedding inversion).
- Novel injection attacks not in our pattern set or beyond what the classifier catches.
- Determined adversaries with full knowledge of our taint-tracking thresholds (the n-gram window is documented; a 70%+ rewrite evades).
- Supply-chain compromise of upstream packages.

---

## 8. Data the engine keeps

- Audit log: every decision + outcome (PII redacted before write).
- Approval queue: each pending action with redacted args.
- Encrypted credentials: AES-256-GCM at rest.
- Taint records: per-session, 30 minute TTL, capped at 50 records.
- Anomaly counters: per-tenant + per-agent rolling windows (in-memory).
- Rate-limit buckets: in-memory.
- Circuit-breaker state: in-memory.

In-memory state is volatile. For multi-instance deployments, the persistence hooks (`exportSnapshot` / `importSnapshot`) need to be wired to Redis or Postgres.

---

## 9. Where to add a new detector

1. New PII type: add validator to `packages/dlp/src/validators.ts`, add layer to `packages/dlp/src/pii-detector-v2.ts`, update REDACTION_LABEL, add test in `packages/dlp/src/__tests__/`.
2. New injection pattern: add to `packages/prompt-shield/src/patterns-extended.ts`.
3. New attack chain: add to `ATTACK_CHAINS` in `packages/policy-engine/src/attack-chains.ts`.
4. New connector: copy `packages/connectors/_template/`, register in `bundle/src/index.ts`, add credential requirements to `apps/api/src/connector-requirements.ts`.
5. New shield MCP tool: add to `SHIELD_TOOLS` in `packages/mcp-server/src/shield-tools.ts`.

Every new detector should ship with a labeled scenario in `bench/scenarios.json`.
