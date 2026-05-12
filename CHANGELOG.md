# Changelog

All notable changes to JAK Shield are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); JAK Shield adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-05-11

Initial public release.

### Added

- **MCP server** with stdio + HTTP transports, exposing 20 `shield.*` tools and 24 protected connectors.
- **Deterministic policy engine** with 8 built-in rules (dangerous shell, dangerous SQL, external-email PII, prod-deploy, payments, social-publish, fs sandbox, browser denylist) and a 10-stage decision pipeline.
- **PII detector v2** — 28 PII types with cryptographic checksum validators (Luhn, Verhoeff, mod-97, ABA, mod-11, CPF/CNPJ, SIN, NRIC, TFN, EIN, IMEI, Bitcoin, Ethereum, IPv6, MAC).
- **Injection detector v2** — 6 stages (standard regex, structural HTML/JSON, Unicode confusables, base64/hex/percent decode, spaced-letter de-spacing, multilingual) with 80+ patterns across 12 languages (EN, ES, FR, DE, IT, PT, RU, ZH, JA, KO, HI, AR, TR, VI).
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
- **Performance** — 1742 decisions/sec, p95 0.64ms (77× margin against 50ms SLO).
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

[Unreleased]: https://github.com/YOUR_GH_HANDLE/jak-shield/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YOUR_GH_HANDLE/jak-shield/releases/tag/v0.1.0
