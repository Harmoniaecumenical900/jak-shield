# SOC 2 roadmap for JAK Shield

**Status as of 2026-05-13:** *Pre-engagement.* We do not have SOC 2 Type I
or Type II. This document is the honest plan for getting there, what's
already in place from a controls standpoint, and what a customer who needs
SOC 2 today should know.

If you're a buyer asking "can I deploy JAK Shield in a regulated
environment?" — read the [Buyer FAQ](#buyer-faq) section first.

---

## Why SOC 2 isn't done yet

It's not a documentation problem, it's a *time and money* problem:

- **Type I audit:** ~$15–25K with a CPA firm, requires a point-in-time
  attestation of designed controls. Earliest realistic date for JAK Shield:
  ~3 months from start of engagement.
- **Type II audit:** ~$25–50K, requires a 3–12 month *observation window*
  during which the designed controls must be operating effectively. So the
  earliest plausible Type II report date is ~9 months from engagement start.
- **Compliance automation platform** (Vanta / Drata / Secureframe /
  Tugboat Logic): ~$10–25K/year, automates ~70% of the evidence collection.
  Without one, plan for ~2× the internal time.

We will not start the engagement until JAK Shield has at least one paying
customer who needs SOC 2 — anything earlier is burning money on an audit of
controls no one is depending on. If you're that customer, [open a
discussion](https://github.com/inbharatai/jak-shield/discussions/new?category=general)
and we'll prioritize.

---

## What's in place today (the controls part — already done)

SOC 2 audits five "Trust Service Criteria": Security, Availability,
Confidentiality, Processing Integrity, Privacy. Most engagements scope to
Security + one or two others. Here's where JAK Shield's *code* already
satisfies an auditor's evidence ask:

### CC6.1 — Logical Access
- ✅ RBAC engine with 5 roles (EXTERNAL_AUDITOR · END_USER · REVIEWER · OPERATOR · TENANT_ADMIN), `packages/policy-engine/src/rbac.ts`
- ✅ Per-tenant API key scoping (`packages/auth/src/api-keys.ts`)
- ✅ JWT-based session auth with rotation slot (`JAK_SHIELD_JWT_SECRET`)
- ✅ Capability tokens — short-lived, single-use, args-bound, HMAC-signed
- ✅ Heightened-scrutiny mode after override (v0.2) — tightened thresholds, one-strike rule

### CC6.7 — Restriction of Transmission, Movement, and Removal of Information
- ✅ Field-level encryption at rest (AES-256-GCM, `packages/core/src/encryption.ts`)
- ✅ Production boot-time refusal if dev secrets detected (`assertSigningSecretReady()`)
- ✅ Audit-log redaction of PII before persistence (`packages/dlp/src/persistence-redactor.ts`)

### CC7.1 — System Operations — Detection of New Vulnerabilities
- ✅ Adversarial benchmark in CI (`bench/run-bench.mjs` — 45 scenarios)
- ⏳ Dependabot alerts — **enable in Settings → Security analysis** (Row 2 of `LAUNCH_STATUS.md`)
- ⏳ Secret scanning + push protection — **enable in Settings → Security analysis**
- ⏳ CodeQL or equivalent SAST — to be added to CI

### CC7.2 — System Operations — Monitoring
- ✅ In-process Prometheus metrics (15+ counters/gauges/histograms)
- ✅ Audit log with tamper-evident HMAC-signed decisions
- ✅ Multi-window anomaly detector (1m / 5m / 1h / 24h)
- ✅ Per-tenant + per-agent baselines

### CC7.3 — System Operations — Incident Response
- ⏳ `SECURITY.md` exists at repo root (verify reporting address is real before publishing)
- ⏳ Incident-response runbook — not yet written; see `engineering:incident-response` skill
- ✅ Audit log query API for post-incident forensics (`apps/api/src/routes/audit.ts`)

### CC8.1 — Change Management
- ✅ Git history is the source of truth
- ✅ All commits signed via Co-Authored-By trailer (process documented in CLAUDE.md if it exists)
- ⏳ Branch protection on `main` requiring PR + 1 approval — **enable in Settings → Branches**
- ⏳ CODEOWNERS file auto-assigns reviewers — **add `* @inbharatai` to `.github/CODEOWNERS`**

### A1.1 — Availability — Capacity
- ✅ Token-bucket rate limiter (60/min general, 10/min auth)
- ✅ Circuit breakers per connector
- ✅ Graceful SIGTERM/SIGINT shutdown
- ⏳ Multi-region failover — not in scope until needed by a customer

### C1.1 — Confidentiality — Identification and Protection
- ✅ PII detection across 28 types with cryptographic checksum validators
- ✅ Redaction at the persistence boundary (audit log) and the transmission boundary (DLP scan on output)
- ✅ Compliance hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA) with citations + disclaimer

### P5.1 — Privacy — Inquiry, Complaint, and Dispute Resolution
- ✅ Discussion board for public inquiries
- ⏳ Privacy policy / DPA template — needed before first regulated customer

### Processing Integrity — Quality Assurance
- ✅ 164 tests passing (`pnpm -r test`)
- ✅ 45-scenario adversarial bench in CI (`pnpm bench`)
- ✅ Performance regression check (`bench/perf-bench.mjs` — 50ms p95 SLO)
- ✅ All decisions HMAC-signed with key rotation; tampering invalidates signature (regression-tested)

---

## The non-code part (the bigger workstream)

These are the auditor asks that aren't satisfied by writing code — they
need policies, procedures, and evidence of consistent execution over time.

### Pre-engagement (~$0, ~2 weeks of focused work)

1. **Acceptable Use Policy** — covers contractors, AI tools, dev laptops.
2. **Access Control Policy** — onboarding/offboarding, least privilege, MFA mandate.
3. **Change Management Policy** — branch protection, code review, deploy approvals.
4. **Incident Response Policy** — severity levels, escalation, postmortem requirement.
5. **Vendor Management Policy** — every SaaS that touches customer data, with a DPA.
6. **Business Continuity / Disaster Recovery Policy** — backups, RTO, RPO targets.
7. **Risk Assessment** — annual document, top 10 risks, mitigation status.
8. **Background checks** — for every employee/contractor with access to production.

For an open-source solo project starting out, items 1–7 are templates from
the audit firm. Item 8 starts mattering when you hire the second engineer.

### During engagement (~$30–60K, ~6–9 months)

1. **Pick a CPA firm.** A-LIGN, Schellman, Prescient, BARR — these are the
   well-known SOC 2 auditors. Pricing varies wildly; get 3 quotes.
2. **Pick a compliance automation platform.** Vanta is the default. Drata
   is good. Secureframe is good. Tugboat Logic is good.
3. **Implement the policies** above with the platform's templates.
4. **Connect the evidence collectors** — GitHub, AWS/Render/Fly, your
   identity provider, your endpoint protection, etc. They auto-pull
   evidence into the platform.
5. **Quarterly access reviews** — list everyone with prod access, confirm
   each is still needed.
6. **Quarterly vulnerability scan reviews** — Dependabot + your SCA tool's
   output, with disposition for every High/Critical.
7. **Annual penetration test** — required by many large customers; ~$15–30K.
8. **Type I attestation** — auditor confirms designed controls. ~1 day on-site.
9. **Type II observation window** — minimum 3 months, typically 6–12.
10. **Type II report** — auditor confirms controls operated effectively
    over the window.

---

## Buyer FAQ

### "We need SOC 2 to deploy this. What are our options?"

Three paths, ranked by realistic time-to-value:

1. **Self-host JAK Shield inside your existing SOC 2 boundary.** It's
   open-source, MIT-licensed, runs in-process or as a sidecar. Your
   existing SOC 2 attestation covers the deployment — JAK Shield's lack of
   its own attestation isn't blocking. This is the recommended path for
   any team that already has a SOC 2 cloud account.
2. **Wait for our Type I (~Q4 2026 if you sponsor the engagement, ~Q2 2027
   without sponsorship).** [Open a discussion](https://github.com/inbharatai/jak-shield/discussions/new?category=general)
   if your timeline is in that window.
3. **Fork it, harden it, get your own attestation for the fork.** MIT
   means MIT.

### "Do you have a pentest report?"

Not yet. Once we have a paying customer with that requirement, we'll
commission one. The adversarial benchmark in CI is a *test*, not a
*pentest* — they catch different classes of issue.

### "Can we sign a DPA before SOC 2 is done?"

Yes — a Data Processing Agreement is independent of SOC 2 and we can
execute one today for any customer with their GDPR/DPDP/CCPA template.

### "What about ISO 27001?"

Same shape as SOC 2 in terms of cost and timeline, with more global
recognition. We'll do SOC 2 first because the US-market customer pull is
stronger; ISO 27001 is the natural follow-on (~6 months overlap on most
controls).

---

## What will change in the README when each milestone lands

| Milestone | README badge | Comparison-table cell |
|---|---|---|
| Today | "SOC 2: not yet" (current) | ❌ *(pre-customer)* |
| Engagement starts | "SOC 2: in progress" | "⏳ Type I in progress" |
| Type I report | SOC 2 Type I (date) | ✅ Type I |
| Type II report | SOC 2 Type II (date) | ✅ Type II |
| ISO 27001 (later) | + ISO 27001 (date) | ✅ Type II + ISO 27001 |

---

*This document is a commitment to honesty, not a commitment to a specific
date. It will be updated as the engagement status changes. If you're
waiting on SOC 2 to deploy JAK Shield and you can sponsor the engagement,
let us know.*
