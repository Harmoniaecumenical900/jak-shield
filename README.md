<div align="center">

<img src=".github/assets/jak-shield-banner.svg" alt="JAK Shield" width="780" />

# JAK Shield

### **The universal security gateway for AI agents.**

*Every Claude / OpenAI / Cursor / VS Code / LangChain / CrewAI tool call passes through Shield first.<br/>Block destructive actions, redact PII, detect prompt injection, require human approval — before the agent touches the real world.<br/>Override with scrutiny when you know better. Pause for bounded ops windows. **CRITICAL rules** (`rm -rf /`, `DROP TABLE`, prod-deploy, payments) **never yield.***

<br/>

[![Release](https://img.shields.io/github/v/release/inbharatai/jak-shield?style=for-the-badge&logo=github&color=7C3AED)](../../releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/inbharatai/jak-shield/ci.yml?branch=main&label=CI&logo=github&style=for-the-badge)](../../actions)
[![Tests](https://img.shields.io/badge/tests-179%20passing-brightgreen?style=for-the-badge)](#-test--benchmark-results)
[![Adversarial Bench](https://img.shields.io/badge/adversarial%20bench-45%2F45-brightgreen?style=for-the-badge)](./bench/scenarios.json)
[![Decision Latency](https://img.shields.io/badge/p95%20latency-~2.3ms-blue?style=for-the-badge)](./bench/perf-bench.mjs)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)

[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.29-7C3AED?style=for-the-badge&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-ready-D97757?style=for-the-badge)](https://claude.ai/download)
[![Cursor](https://img.shields.io/badge/Cursor-ready-000000?style=for-the-badge)](https://cursor.com)
[![OpenAI Agents](https://img.shields.io/badge/OpenAI_Agents_SDK-ready-10A37F?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![VS Code](https://img.shields.io/badge/VS_Code-ready-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)

[![Twitter](https://img.shields.io/badge/follow-@reetur_aj-1DA1F2?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/reetur_aj)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://github.com/inbharatai/jak-shield/discussions)
[![Stars](https://img.shields.io/github/stars/inbharatai/jak-shield?style=for-the-badge&logo=github)](../../stargazers)
[![Sponsor](https://img.shields.io/badge/♥-Sponsor-EA4AAA?style=for-the-badge)](https://github.com/sponsors/inbharatai)

[**Quick start →**](#-quick-start)  ·  [**Live demo →**](#-30-second-demo)  ·  [**Docs →**](./docs)  ·  [**Discord →**](https://github.com/inbharatai/jak-shield/discussions)

</div>

---

## 🛡️ Why JAK Shield exists

In 2026 every AI agent — Claude, OpenAI, Cursor, VS Code Copilot, the LangChain / CrewAI / Vercel AI graph you shipped last Tuesday — has the power to **send email, query Postgres, run shell commands, call GitHub, post to Slack, move money**. None of them ask first.

**One prompt injection in a webpage. One hallucinated `DROP TABLE`. One leaked SSN in an email body. One bad day.**

JAK Shield sits between any MCP-compatible AI client (or framework, via adapter) and the real tools, intercepting every call:

```
 AI Agent ─► JAK Shield ─► [policy engine + DLP + injection scan + taint + approval] ─► real tool
                                ↑
                          override (v0.2) · pause (v0.3) · always-on CRITICAL block
```

It's the **MCP-native** security layer your agents need — open-source, deterministic, signed, auditable, and **~2 ms p95** end-to-end through MCP stdio. The full pipeline is ten stages of which the deterministic engine has final say; the OpenAI classifier (when configured) advises but never overrides.

> **What "the human stays in control" actually means here.**
>
> JAK Shield ships three escape hatches, each with a tighter scope than the one before:
>
> - **Per-call override** *(v0.2)* — every overridable BLOCK surfaces *what*, *why*, and the *worst case*. The user accepts the risk in writing (≥ 8 chars, audit-logged) via `shield.override_block`. Acceptance mints a single-use HMAC-signed token AND opens a **heightened-scrutiny window** for the next 10 calls — anomaly z-score drops 3.0 → 1.5, taint Jaccard drops 0.30 → 0.15, and any further block in the window is **unconditionally hard-block**. One-strike rule.
> - **Bounded session/tenant pause** *(v0.3)* — for known-safe operational windows (migrations, debugging prod data, planned ops), `shield.pause` suspends non-CRITICAL blocks for **1–60 minutes** (default 15) with a written reason ≥ 20 chars. Pause auto-expires. Every decision during the window is annotated with `metadata.pausedState` for UI banners. When pause ends, the **same 10-call heightened-scrutiny window** kicks in.
> - **`shield.stand_down`** — end the heightened-scrutiny window early when the task is done.
>
> **The bright line: CRITICAL rules never yield.** `rm -rf /`, `DROP TABLE` without `WHERE`, `mkfs`, fork bombs, prod-deploy without ticket, payment without idempotency, capability-token replay or tamper, offensive-cyber, prompt-injection input — none of these are overridable, pausable, or escapable. The user changes the request, not the verdict. Tested and enforced in code via `NEVER_OVERRIDABLE_RULES` (`packages/policy-engine/src/block-override.ts`) and `NEVER_PAUSABLE_RULES` (`packages/policy-engine/src/shield-pause.ts`).
>
> Every override and every pause is audit-logged with the human's user id and the written reason — see the [How blocks, approvals, overrides, and pause actually work](#-how-blocks-approvals-overrides-and-pause-actually-work) section for the full lifecycle.

---

## ⚡ 30-second demo

<div align="center">

<img src=".github/assets/jak-shield-demo.gif" alt="JAK Shield blocking a DROP TABLE call inside Claude Desktop" width="780" />

</div>

*This GIF is generated from [`jak-shield-demo.svg`](./.github/assets/jak-shield-demo.svg) by [`scripts/generate-demo-gif.mjs`](./scripts/generate-demo-gif.mjs) — pure-Node, no headless browser, no ffmpeg. If you want a real screen recording from your own Claude Desktop, run [`scripts/record-demo.ps1`](./scripts/record-demo.ps1) (requires ffmpeg + ScreenToGif). The asciinema cast of the test suite is at [`.github/assets/demo.cast`](./.github/assets/demo.cast).*

```
You:    "Send a quick summary of customer data to partner@external.com"

Agent:  uses gmail.send_email with body containing SSN 123-45-6789, Aadhaar 234123412346

🛡️ JAK Shield decision:
   action:  requires_approval
   rule:    external-email-pii
   risk:    HIGH
   reason:  External email to partner@external.com contains SSN, AADHAAR, STUDENT_RECORD
   safe_alternative:  Send an anonymized summary instead.
   compliance:  PCI_DSS · HIPAA · GDPR · CCPA · DPDP · FERPA
   signature:  d8e709423cb1a0... (HMAC-verified)
   approval_id:  apr_d192c5a09f94e77e
```

Same payload sent through any other MCP client *without* Shield — quietly leaves your network.

**Override path** (new in v0.2):

```
You:    "I vetted partner@external.com yesterday — accept the risk and send."

Agent:  shield.override_block({
          blocked_decision: <signed BLOCK from above>,
          human_reason: "Partner@external.com is vendor on contract since 2025-09; legal-cleared.",
          accepted_by: "reetu"
        })

🛡️ JAK Shield response:
   ok:                 true
   override_token:     eyJhbGciOi...  (single-use, 60 s TTL)
   scrutiny_calls:     10
   scrutiny_note:      "Anomaly + taint thresholds tightened for the next 10 calls
                        in this session. Any further block is NOT overridable."
   audit_note:         OVERRIDE_ACCEPTED tenant=t1 session=s1 rule=external-email-pii ...
```

If the same agent then tries to delete the customer table 30 seconds later, the override does *not* save it — that BLOCK is now hard, no second chance until you `shield.stand_down` or the window expires.

---

## 🚀 Quick start

### Install for Claude Desktop (1 minute)

```bash
git clone https://github.com/inbharatai/jak-shield.git
cd jak-shield
pnpm install && pnpm build
node scripts/install-claude-desktop-mcp.mjs   # auto-wires Claude Desktop
```

Restart Claude Desktop. Ask: *"What jak-shield tools do you have?"* — you'll see **23 shield primitives** + the connector wrappers (Gmail, GitHub, Postgres, Supabase, shell, filesystem, browser, HTTP, Slack, SMS, webhook, Google Drive, social).

### 🌍 Works with any MCP-compatible AI client (and most others via adapter)

JAK Shield speaks the [Model Context Protocol](https://modelcontextprotocol.io). Any client that does too can use it with zero JAK-Shield-specific code.

**MCP-native — wire up and go:**

| Client | Transport | Config |
|---|---|---|
| 🟪 [Claude Desktop](https://claude.ai/download) | stdio | `configs/mcp/claude-desktop.json` |
| 🟪 [Claude Code](https://docs.anthropic.com/claude-code) CLI | stdio | `~/.claude/mcp.json` |
| 🟪 [Anthropic Claude API](https://docs.anthropic.com) | HTTP | `tools: [{ type: "mcp", server_url }]` |
| 🟢 [OpenAI Agents SDK](https://openai.github.io/openai-agents-python) | HTTP | `configs/mcp/openai-agents-example.ts` |
| 🟢 [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) | HTTP | `tools: [{ type: "mcp", server_url }]` |
| ⬛ [Cursor](https://cursor.com) | stdio | `configs/mcp/cursor-mcp.json` |
| 🟦 [VS Code](https://code.visualstudio.com) (Copilot Chat / Cline / Roo Code) | stdio | `configs/mcp/vscode-mcp.json` |
| 🟫 [Windsurf](https://windsurf.com) | stdio | `~/.codeium/windsurf/mcp_config.json` |
| ⚫ [Zed](https://zed.dev) | stdio | `~/.config/zed/settings.json` |
| 🟡 [Goose](https://block.github.io/goose/) (Block) | stdio | `~/.config/goose/profiles.yaml` |
| 🟠 [Continue.dev](https://continue.dev) | stdio | `~/.continue/config.json` |
| 🟢 [Mastra](https://mastra.ai), [n8n](https://n8n.io), [LibreChat](https://librechat.ai), [5ire](https://5ire.app) | varies | their respective MCP config |
| 🐍 [LangChain](https://www.langchain.com) (Python / JS) | stdio / HTTP | `MultiServerMCPClient` |
| 🦙 [LlamaIndex](https://www.llamaindex.ai) | stdio / HTTP | `BasicMCPClient` |
| 🧰 Any custom client (TS / Python / Java / Kotlin / C# / Swift SDKs) | either | use the [official SDKs](https://modelcontextprotocol.io/docs) |

**Non-MCP today — needs a thin adapter (drop-in REST call):**

| Tool | Why an adapter | How |
|---|---|---|
| ChatGPT Custom GPTs / Actions | Uses OpenAI Actions (OpenAPI 3.1), not MCP | Host the JAK Shield REST API spec |
| Google Gemini | Google's function-calling protocol | Wrap `shield.*` tools as `FunctionDeclaration`s |
| xAI Grok / DeepSeek / Mistral / Cohere | OpenAI-compatible tools or their own | Call `POST /api/evaluate` from your tool handler |
| CrewAI · AutoGen · LangGraph (Python) | Python tool-class native | Subclass `BaseTool` to POST to JAK Shield |
| Zapier · Make · IFTTT | Webhook-based | Point the webhook at `POST /api/evaluate` |
| Anything that can POST HTTPS | n/a | JAK Shield's REST API accepts any JSON |

The honest part: MCP-native clients = zero code from you. Adapter clients = ~30 min per platform. If you want pre-built adapters for any of the above, [open an issue](../../issues/new?template=feature_request.md) and we'll prioritize.

---

### Install for Cursor / VS Code / OpenAI Agents SDK

Configs are pre-built in `configs/mcp/`:

```jsonc
// ~/.cursor/mcp.json  (or vscode-mcp.json)
{
  "mcpServers": {
    "jak-shield": {
      "command": "node",
      "args": ["./node_modules/@jak-shield/mcp-server/dist/stdio.js"]
    }
  }
}
```

### Install as remote MCP gateway (Docker)

```bash
docker-compose up -d
# MCP gateway:   http://localhost:4101/mcp/<tenantId>
# Dashboard:     http://localhost:3000
# API:           http://localhost:4100
```

### One-click install via Smithery

Once published to Smithery, JAK Shield is one-click installable into any compatible client (Claude Desktop, Cursor, Cline, Windsurf):

> **https://smithery.ai/server/reetu004/jak-shield**  *(pending publish — see `docs/PUBLISH_TO_SMITHERY.md`)*

Smithery handles config schema, secrets prompting (OpenAI key, encryption key, corporate domains), and the `.mcpb` install — driven by the [`smithery.yaml`](./smithery.yaml) at the repo root.

### Install via npm

```bash
npm install -g @jak-shield/mcp-server     # once published
jak-shield-mcp                            # stdio transport
```

Until then, install from the GitHub release:

```bash
# Download the .mcpb bundle from the v0.3.0 release
curl -L -o jak-shield.mcpb https://github.com/inbharatai/jak-shield/releases/download/v0.3.0/jak-shield-0.3.0.mcpb
# Double-click the .mcpb to install into Claude Desktop
```

### Download a specific release

- **[v0.3.0](https://github.com/inbharatai/jak-shield/releases/tag/v0.3.0)** — latest · user-controlled pause + auto-resume
- **[v0.2.0](https://github.com/inbharatai/jak-shield/releases/tag/v0.2.0)** — block override + heightened scrutiny
- **[v0.1.0](https://github.com/inbharatai/jak-shield/releases/tag/v0.1.0)** — initial public release

---

## ✨ What you get

<table>
<tr>
<td width="50%">

### 🚦 Deterministic policy engine
- 8 built-in rules (dangerous shell, dangerous SQL, external-email PII, prod-deploy, payments, social-publish, fs sandbox, browser denylist)
- Role-based access control (5 roles)
- Configurable approval thresholds
- Risk-class taxonomy: `READ_ONLY` · `WRITE` · `EXTERNAL_SIDE_EFFECT` · `DESTRUCTIVE`

### 🧬 Multi-stage prompt-injection detection
- 6 detection stages: standard · structural · Unicode confusables · base64/hex decode · spaced-letters · multilingual
- 80+ patterns across **13 non-English languages** plus an English baseline — ES · FR · DE · IT · PT · RU · ZH · JA · KO · HI · AR · TR · VI (verifiable: `grep "lang:" packages/prompt-shield/src/patterns-extended.ts`)
- RAG-poisoning · tool-name spoofing · indirect injection · format-token attacks
- Caught Cyrillic confusables + base64-encoded + Russian polyglot attack in production

### 🩺 PII detection with cryptographic validators
- **28 PII types** including SSN · Aadhaar · IBAN · PAN · NRIC · CPF · CNPJ · SIN · TFN · EIN · IMEI · Bitcoin · Ethereum
- Luhn (credit cards), Verhoeff (Aadhaar), mod-97 (IBAN), ABA, mod-11 (NHS) checksum validation
- Context-window confidence scoring
- 12 secret types: AWS · GitHub · Stripe · OpenAI · Anthropic · GCP · JWT · PEM · …

</td>
<td width="50%">

### 🧲 Taint tracking *(novel for MCP)*
- MinHash + n-gram fingerprinting (paraphrase-resistant)
- Per-session, TTL-bounded
- Blocks UNTRUSTED data flowing into sensitive sinks

### 🔗 Cross-call attack-chain detection
- 20 multi-step attack patterns (read PII → exfiltrate, credential harvest, recon → destroy, etc.)
- Data-flow tracking (output of step N → args of step N+1)
- Time-decay weighting

### 📊 Behavioral anomaly detection
- EWMA + z-score baselines
- Multi-window (1m / 5m / 1h / 24h)
- Per-tenant + per-agent
- Burst · first-seen-destructive · spike signals

### 🔐 Tamper-evident decisions + capability tokens
- HMAC-SHA256 signed decisions with key rotation
- Short-lived (60 s default), single-use, scope-bound capability JWTs
- Per-tenant AES-256-GCM credential vault

### 📜 Regulatory hints *(not legal classifications)*
- Auto-tag every decision: PCI DSS · HIPAA · GDPR · CCPA · SOX · FERPA · DPDP
- CFR / GDPR article citations
- Explicit confidence levels + disclaimer ("triage signals, not compliance certification")

### 🛰️ Production-ready ops
- Prometheus `/metrics` (15 + counters/gauges/histograms)
- Token-bucket rate limiting (60/min general, 10/min auth)
- Circuit breakers per connector
- Graceful SIGTERM/SIGINT shutdown
- Boot-time refusal in `NODE_ENV=production` if dev secrets detected

### 🛂 Block override + heightened scrutiny *(v0.2)*
- Every BLOCK decision surfaces *what* and *why* it was blocked, plus an **override offer** if the rule isn't on the hard-stop list
- CRITICAL-class blocks (`rm -rf /`, `DROP TABLE` without `WHERE`, prod-deploy without ticket, payment without idempotency, capability-token replay, etc.) are **never overridable** — change the request, not the verdict
- Accepting an override mints a single-use HMAC-signed token AND opens a **heightened-scrutiny window** for the next 5–10 calls in the session: anomaly z-score threshold drops 3.0 → 1.5, taint Jaccard threshold drops 0.30 → 0.15, and any further block in the window is **not overridable**
- Every override (accepted or refused) is audit-logged with the human's user id + free-text reason ≥ 8 chars
- MCP tools: `shield.override_block`, `shield.scrutiny_status`, `shield.stand_down`
- Override field is included in the signed canonical form — tampering with `overridable` invalidates the HMAC

### ⏸️ User-controlled pause + resume *(v0.3 — new)*
- For when you know exactly what you're doing — running a migration, debugging prod data, working through a known-safe ops window — and per-call override is too much friction
- `shield.pause` suspends NON-CRITICAL blocks for a bounded window (1–60 min, default 15). Required: written reason ≥ 20 chars. Optional: `scope` (session / user / tenant) and `also_enforce_rules` for narrow scoping.
- **CRITICAL rules STILL fire even during pause** — `rm -rf /`, `DROP TABLE` without `WHERE`, prod-deploy without ticket, payment without idempotency, offensive-cyber, capability-token replay, prompt-injection input. These are hard-coded non-pausable. The user changes the request, not the verdict.
- Pause is **time-bounded and auto-expires**. No "indefinite off." Max 60 minutes per request.
- Every decision during a pause window is decorated with `metadata.pausedState` so UIs can show a prominent "JAK Shield is paused (14 min remaining)" banner
- When the pause ends (auto or manual via `shield.resume`), the session enters **heightened scrutiny** for the next 10 calls — same tightened thresholds as the override flow. Pause + scrutiny is the post-window guardrail.
- Audit-logged at pause start, on each suppressed block during the window, and at pause end
- MCP tools: `shield.pause`, `shield.resume`, `shield.pause_status`

</td>
</tr>
</table>

---

## 🧠 How it works

```mermaid
flowchart LR
    A[AI Client<br/>Claude · OpenAI · Cursor · VS Code] -->|MCP stdio/HTTP| B[JAK Shield MCP Server]
    B --> C{decide&#40;&#41;}
    C --> D[Hard rules<br/>block]
    C --> E[Injection v2<br/>6 stages, 13+EN langs]
    C --> F[Taint tracker<br/>MinHash n-grams]
    C --> G[Attack-chain<br/>20 patterns]
    C --> H[Soft rules<br/>approval/redact]
    C --> I[PII v2<br/>28 types + checksums]
    C --> J[Anomaly<br/>EWMA + z-score]
    C --> K[RBAC + threshold]
    C --> L[OpenAI classifier<br/>advisor]
    C --> M[HMAC sign]
    M --> N[Connector<br/>Gmail · GitHub · SQL · Shell · …]
    M --> O[Approval queue]
    M --> P[Audit log]
    M --> Q[Prometheus]
```

Decision pipeline end-to-end (MCP stdio + serialization + policy + signing) runs in **~2–3 ms p95** on stock CPU, well under the 50 ms SLO. Full architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 🚦 How blocks, approvals, overrides, and pause actually work

Every tool call gets one of five outcomes. Here's what each looks like on the wire and how to handle it.

### The five outcomes at a glance

| Action | When it happens | What you do |
|---|---|---|
| `allow` | Safe call, no signals | Connector executes, you get the result |
| `redact` | PII detected but the call is otherwise fine | Connector executes with redacted args (e.g. SSN → `***-**-6789`) |
| `requires_approval` | Risky but not destructive (external email, social publish, etc.) | A reviewer must approve via dashboard or `shield.check_approval` |
| `block` | Destructive / known-attack pattern | Call refused. If overridable, you get an offer with the worst-case spelled out |
| `rewrite` | Classifier proposed a safer alternative | Use the suggested rewrite or refine your prompt |

CRITICAL-class blocks (`rm -rf /`, `DROP TABLE` without `WHERE`, prod-deploy without ticket, payment without idempotency, capability-token replay, offensive-cyber, prompt-injection input) are **never** overridable and **never** yield to pause. They're the bright line.

---

### Flow 1 — Approval (the most common "I'm not sure" case)

Trigger: agent calls `gmail.send_email` to an external domain with PII in the body.

```jsonc
// 1. Agent's tool call goes through Shield first
{
  "tool": "shield.evaluate_tool_call",
  "args": {
    "tool_name": "gmail.send_email",
    "args": { "to": "partner@external.com", "subject": "Q4 roster", "body": "SSN 123-45-6789..." }
  }
}

// 2. Shield's decision
{
  "action": "requires_approval",
  "rule": "external-email-pii",
  "risk": "HIGH",
  "reason": "External email to partner@external.com contains SSN, AADHAAR, STUDENT_RECORD",
  "compliance": ["GDPR", "FERPA", "HIPAA"],
  "approval_id": "apr_a1b2c3d4e5f6",
  "signature": "d8e709423cb1a0..."  // HMAC-verified
}

// 3. A reviewer decides (dashboard or API)
POST /api/approvals/apr_a1b2c3d4e5f6/decide  { "decision": "approve", "decided_by": "reetu" }
// or
{ "tool": "shield.check_approval", "args": { "approval_id": "apr_a1b2c3d4e5f6" } }
// → returns { "status": "APPROVED", "decided_by": "reetu", "decided_at": "..." }

// 4. Agent re-invokes with the approved approval_id
{ "tool": "shield.proxy_tool_call", "args": { "tool_name": "gmail.send_email", "args": {...}, "approval_id": "apr_a1b2c3d4e5f6" } }
// → executes, audit-logged
```

Approvals time out (default 24 h). Pending approvals are visible at `/approvals` in the dashboard.

---

### Flow 2 — Block override *(v0.2)* — when YOU know the block is wrong

Trigger: same `gmail.send_email` to a vendor your team vetted yesterday but Shield doesn't know about.

```jsonc
// 1. Shield blocks
{
  "action": "block",
  "rule": "external-email-pii",
  "risk": "HIGH",
  "reason": "External email contains SSN...",
  "override": {
    "overridable": true,
    "humanReason": "External email contains SSN...",
    "worstCase": "Email could leak PII to an external recipient who is not your customer or vendor.",
    "scrutinyCalls": 10,
    "ttlSeconds": 60,
    "scopedToRule": "external-email-pii",
    "blockId": "blk_xyz"
  },
  "signature": "d8e7..."  // HMAC covers the override fields too
}

// 2. You accept the risk in writing
{
  "tool": "shield.override_block",
  "args": {
    "blocked_decision": <the entire block decision from step 1>,
    "human_reason": "partner@external.com is a vendor on contract since 2025-09; legal-cleared yesterday",
    "accepted_by": "reetu"
  }
}

// 3. Shield mints a single-use override token + opens scrutiny window
{
  "ok": true,
  "override_token": "eyJhbGciOi...",  // single-use, 60s TTL
  "scrutiny_calls": 10,
  "scrutiny_note": "JAK Shield is still watching. Anomaly + taint thresholds are tightened for the next 10 calls in this session. Any further block is NOT overridable."
}

// 4. Next call passes the token — bypasses *this rule for this exact args hash*
{ "tool": "shield.proxy_tool_call", "args": { "tool_name": "gmail.send_email", "args": {...}, "override_token": "eyJ..." } }
```

**What if you try to override a CRITICAL block?**

```jsonc
// Shield blocks DROP TABLE — risk=CRITICAL, rule=dangerous-sql-drop-without-where
// Note: the response has NO `override` field at all — that's how you know it's not overridable

// You try anyway:
{ "tool": "shield.override_block", "args": {...} }
// →
{ "ok": false, "code": "NO_OFFER", "reason": "This block did not come with an override offer. CRITICAL-risk blocks and certain rules are intentionally non-overridable." }
```

You change the request, not the verdict.

---

### Flow 3 — Pause *(v0.3)* — when you know you'll be doing risky-looking work for a window

Trigger: you're running a planned database migration that includes a few `TRUNCATE TABLE` calls Shield would normally block. The override flow (10 calls of grace) isn't enough.

```jsonc
// 1. Pause the session for up to 60 minutes
{
  "tool": "shield.pause",
  "args": {
    "scope": "session",
    "reason": "Running planned Q4 migration tested in staging — known safe window for next 30 min",
    "duration_minutes": 30,
    "also_enforce_rules": ["external-email-pii"]  // still block PII leaks even during the window
  }
}

// 2. Shield acknowledges + warns
{
  "ok": true,
  "pause_id": "pause_abc123",
  "scope": "session",
  "expires_at": 1747142400000,
  "duration_minutes": 30,
  "warning": "JAK Shield is paused for 30 minute(s). CRITICAL-risk rules (rm -rf /, DROP TABLE without WHERE, prod-deploy without ticket, payment without idempotency, offensive-cyber, capability-token replay) STILL fire. When the pause ends, the next 10 calls run under heightened scrutiny."
}

// 3. While paused — non-CRITICAL blocks suppressed, every decision carries pausedState
{
  "action": "allow",
  "reason": "[PAUSED] Browser scrape of suspicious URL — block suppressed by active pause (session, expires 2026-05-13T15:00:00Z)",
  "metadata": {
    "paused": true,
    "originalAction": "block",
    "originalRule": "browser-scrape",
    "pausedState": {
      "active": true,
      "scope": "session",
      "msRemaining": 1750000,
      "reason": "Running planned Q4 migration...",
      "triggeredBy": "reetu"
    }
  }
}

// 4. CRITICAL rules STILL fire — even during pause
{ "tool": "shield.proxy_tool_call", "args": { "tool_name": "postgres.query", "args": { "sql": "DROP TABLE users" } } }
// → action: "block", rule: "dangerous-sql-drop-without-where", risk: "CRITICAL"
//   (no override offer — never bypassable)

// 5. Done early? Resume manually
{ "tool": "shield.resume", "args": { "scope": "session" } }
// →
{
  "ok": true,
  "duration_actual_seconds": 412,
  "calls_observed": 7,
  "scrutiny_started": true,
  "note": "JAK Shield is back on duty. The next 10 calls in this session run under heightened scrutiny..."
}

// 6. If you don't resume, pause auto-expires at expires_at. Scrutiny still opens.
```

Pause is **scoped, time-bounded, audited, and CRITICAL-immune** — the worst case for a malicious actor with `shield.pause` is suppressing non-CRITICAL blocks for at most 60 min with a permanent audit trail and heightened scrutiny kicking in immediately after.

---

### Flow 4 — Heightened scrutiny window (the after-state)

After every override-accept OR every pause-end, the session enters a **heightened scrutiny window** for the next 10 calls (or 15 minutes, whichever expires first). During that window:

| Threshold | Normal | Under scrutiny |
|---|---|---|
| Anomaly z-score | 3.0 | **1.5** (catches more outliers) |
| Taint Jaccard | 0.30 | **0.15** (catches fuzzier matches of overridden data) |
| Any further block | Eligible for override | **NOT overridable** (one-strike rule) |
| Every decision | Returned as normal | Carries `heightenedScrutiny` field so UIs surface "still watching" |

Check the state any time:

```jsonc
{ "tool": "shield.scrutiny_status", "args": { "context": { "sessionId": "s1", "tenantId": "t1" } } }
// →
{
  "active": true,
  "calls_remaining": 7,
  "triggered_by": "external-email-pii",
  "thresholds": { "anomalyZScore": 1.5, "taintJaccard": 0.15 },
  "warnings": [...]
}
```

End scrutiny early when the override task is complete:

```jsonc
{ "tool": "shield.stand_down", "args": { "context": {...} } }
```

---

### What gets audit-logged

Every state transition emits a structured audit entry. Query via `apps/api`'s `/api/audit` endpoint:

| Event | When | Severity |
|---|---|---|
| `POLICY_DECISION` | Every tool call | INFO |
| `TOOL_CALL_BLOCKED` | Action = block | WARN |
| `APPROVAL_REQUESTED` | Action = requires_approval | INFO |
| `APPROVAL_GRANTED` / `_REJECTED` / `_EXPIRED` | Reviewer decision or timeout | INFO / WARN |
| `POLICY_DECISION_OVERRIDDEN` | Override accepted (or refused) | WARN / INFO |
| `SCRUTINY_STARTED` | Pause begins or override accepted | WARN |
| `SCRUTINY_WARNING` | Detector fired during scrutiny window | INFO |
| `SCRUTINY_ENDED` | Scrutiny window closes (manual or auto) | INFO |
| `PII_DETECTED` / `PII_REDACTED` | DLP scan finding | INFO |
| `INJECTION_DETECTED` | Injection scanner finding | WARN |

Audit details are themselves PII-redacted via `packages/dlp/src/persistence-redactor.ts` before persisting — sensitive payloads don't end up in the log itself.

---

### "How do I know I'm running paused?"

Three signals, in order of how a client UI should surface them:

1. **`metadata.pausedState`** is present on every decision returned during the window. UIs should render a prominent banner: *"⏸ JAK Shield paused (14 min remaining) — paused by reetu, reason: 'Q4 migration'"*.
2. **Suppressed blocks** carry `metadata.originalAction = "block"` and `metadata.originalRule`. So you can show "this call would have been blocked under rule X — fired as allow because of pause."
3. **`shield.pause_status`** is the authoritative read at any time — call it to confirm the state matches what the UI is showing.

---

### "What happens if my agent is partway through a multi-step task when scrutiny kicks in?"

Nothing breaks. The agent gets the same `allow` / `block` decisions it would have gotten — they're just decided with tighter thresholds. A call that was right on the edge of an anomaly might now block; a call that's clearly fine still passes. Every blocked-during-scrutiny decision is non-overridable, so you either change the call or wait out the window.

---

### "Can I configure the thresholds / window sizes?"

The defaults are deliberately conservative. To change them:

- **Override TTL + scrutiny window size** — pass `scrutinyCalls` and `ttlSeconds` in the override offer when building (`packages/policy-engine/src/block-override.ts`).
- **Pause max duration** — hard-capped at 60 min in code (`MAX_PAUSE_MS` in `packages/policy-engine/src/shield-pause.ts`). Change the constant if your environment requires a different cap. Tests will assert anything above the cap is refused.
- **Scrutiny thresholds** — `SCRUTINY_THRESHOLDS` in `packages/policy-engine/src/heightened-scrutiny.ts`. Lower z-score = more sensitive. Lower Jaccard = catches more taint.
- **NEVER_OVERRIDABLE_RULES** + **NEVER_PAUSABLE_RULES** — explicit allowlists in `block-override.ts` and `shield-pause.ts`. Adding a rule to the never-list means no human can bypass it; removing one means it becomes overridable / pausable. Treat changes here as security-impacting.

All of the above are pure code constants — no runtime config. That's intentional. Operators can fork and tune; tenants can't loosen via the API.

---

## 📈 Test & benchmark results

These numbers come from `pnpm build && pnpm test && pnpm bench && node bench/perf-bench.mjs`. **Reproducible.**

| Suite | Result |
|---|---|
| Clean build | **32/32 packages** ✅ |
| Unit + security tests | **179 tests passing** (52 dlp + 67 policy-engine incl. 17 override/scrutiny + 15 shield-pause + 22 e2e security + 20 injection-v2 + 10 sign-decision + 8 observability) ✅ |
| `pnpm bench` adversarial scenarios | **45/45 (100 %)** ✅ |
| `bench/perf-bench.mjs` (1000 iter, end-to-end through MCP stdio) | ~**860 dec/sec** · p50 ~**1.0 ms** · p95 ~**2.3 ms** · p99 ~**3.9 ms** · max ~**5.5 ms** ✅ — measured live, three runs, stable. Earlier README quoted **0.64 ms p95**; that measurement was from a faster prior environment and no longer reproduces, so it has been corrected. |
| Decision SLO | p95 < 50 ms — **~21× margin** |

```text
========== JAK SHIELD ADVERSARIAL BENCHMARK ==========
Overall: 45/45 (100.0%)
  100%  ████████████████████  injection                  2/2
  100%  ████████████████████  injection-unicode          1/1
  100%  ████████████████████  injection-encoding         1/1
  100%  ████████████████████  injection-structural       1/1
  100%  ████████████████████  injection-multilingual     2/2
  100%  ████████████████████  destructive-sql            4/4
  100%  ████████████████████  shell                      5/5
  100%  ████████████████████  offensive-cyber            2/2
  100%  ████████████████████  external-email-pii         2/2
  100%  ████████████████████  pii-strict                 2/2
  100%  ████████████████████  pii-fp-luhn                1/1
  100%  ████████████████████  taint-flow                 (proven via test suite)
  ...
Compliance tags emitted: HIPAA · FERPA · GDPR · CCPA · DPDP · SOX
```

---

## 🔬 The honest part — read before you ship to production

We won't oversell. From our own [audit](./docs/AUDIT.md):

- ❌ **Not certified for any regulatory framework.** The compliance module emits *signals*, not legal classifications. A qualified officer must confirm scope.
- ❌ **No SOC 2, no pentest, no customer reference yet.** Pre-customer, by design — open-source first. The full roadmap (controls already in place, controls still to add, realistic Type I / Type II dates, what to do if you're a regulated buyer today) is in [`docs/SOC2_ROADMAP.md`](./docs/SOC2_ROADMAP.md). TL;DR: most of the *technical* controls auditors check are already shipping (RBAC, encryption at rest, HMAC-signed decisions, tamper-evident audit log, multi-window anomaly detection). What's missing is the audit engagement itself + the policy paperwork + the observation window. ~$30–60K and 6–9 months when there's a customer asking for it.
- ❌ **Not "better than Lakera / Nightfall."** We never measured head-to-head. They have ML-trained models we don't. We're shaped differently — MCP-native, deterministic, fully open.
- ✅ **What is true:** The engine is fast, well-tested, signed, modular, and runs the end-to-end MCP decision pipeline at ~2–3 ms p95 — well under the 50 ms SLO. The taint tracker + capability tokens are genuinely novel for MCP.

If you're a regulated buyer — bank, hospital, school — talk to us before deploying. We'll be honest about what's ready and what isn't.

---

## 🆚 How it compares

> **The honest framing first.** JAK Shield has **never been benchmarked
> head-to-head** against any of the products below. They're all good tools
> with different shapes. The table maps capabilities, not winners. Some of
> these (Lakera, Nightfall) have years of ML-trained models we don't have.
> Some (Cloudflare, PortKey) sit in a completely different place in the
> stack. Some (NeMo, Guardrails AI) are open-source peers with overlapping
> but non-identical scope.

### Where each product sits in the stack

| Product | Shape | Sits between |
|---|---|---|
| **JAK Shield** | Open-source MCP server (or sidecar) | the agent and the *tools* it calls |
| **Anthropic native approvals** | Built into Claude Desktop / Claude Code | Claude and the user, when a tool wants to run |
| **Lakera Guard** | Hosted API, SDK + REST | the app and the *LLM*, or app and user input |
| **Nightfall AI** | Hosted API + SaaS connectors | data sources (Slack, Drive) and the network |
| **Cloudflare AI Gateway** | HTTP proxy | the app and the *LLM provider* |
| **NeMo Guardrails** (NVIDIA, open-source) | Python framework | the chain and the LLM call, programmable via Colang |
| **Guardrails AI** (open-source) | Python validators | LLM output and the app, declarative checks |
| **Promptfoo** (open-source) | CLI + eval framework | dev-time, not runtime — for testing prompts/guards |

### Capability matrix

|  | JAK Shield | Anthropic approvals | Lakera Guard | Nightfall | Cloudflare AI Gateway | NeMo Guardrails | Guardrails AI |
|---|---|---|---|---|---|---|---|
| Ships as MCP server | ✅ stdio + HTTP | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Open source (MIT/Apache) | ✅ MIT | partial (SDK only) | ❌ | ❌ | ❌ | ✅ Apache | ✅ Apache |
| Deterministic policy engine | ✅ TS rules | minimal (allow-list in settings.json) | ❌ ML-first | ❌ ML-first | partial | ✅ Colang DSL | ✅ declarative validators |
| Prompt-injection detection | ✅ 6 stages, 13+EN langs, ReDoS-guarded | ❌ | ✅ ML model | partial (2024+) | partial | ✅ via LLM judge | partial via integrations |
| PII detection | ✅ 28 types + cryptographic checksums | ❌ | ✅ ML | ✅ ML (core product) | ❌ | partial via plugins | partial via validators |
| Taint tracking across calls | ✅ MinHash + n-gram *(novel for MCP)* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-step attack chain detection | ✅ 20 patterns + data-flow | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Behavioural anomaly (EWMA + z-score) | ✅ per-tenant + per-agent | ❌ | ❌ | ❌ | partial | ❌ | ❌ |
| **Block override + heightened scrutiny** *(v0.2)* | ✅ one-strike rule | ❌ binary allow/deny | ❌ | ❌ | ❌ | ❌ | ❌ |
| **User-controlled pause + auto-resume** *(v0.3)* | ✅ scoped, time-bounded, CRITICAL still fires | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Scoped capability tokens | ✅ HMAC JWT, single-use, args-bound | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tamper-evident (HMAC + key rotation) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Decision provenance / evidence tree | ✅ structured per stage | ❌ | partial (returns reasons) | partial | ❌ | ✅ via tracing | partial |
| Regulatory hints w/ citations | ✅ PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA + disclaimer | ❌ | ❌ | ✅ (legal-mode UX) | ❌ | ❌ | ❌ |
| Self-hosted runtime | ✅ stdio in-process or HTTP | ✅ Claude Desktop local | ❌ hosted | ❌ hosted | ❌ hosted | ✅ | ✅ |
| Adversarial bench in repo | ✅ 45 scenarios, 45/45 | ❌ | ❌ (private corpus) | ❌ | ❌ | partial (example tests) | partial (validator examples) |
| End-to-end p95 latency in repo | ✅ ~2.3 ms (`bench/perf-bench.mjs`) | n/a | unknown — typical ML inference 50–200 ms | unknown | network-bound | depends on LLM judge | varies per validator |
| SOC 2 / pentest report | ❌ pre-customer ([roadmap](./docs/SOC2_ROADMAP.md)) | ✅ (Anthropic corporate) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Customer reference logos | ❌ none yet | n/a | ✅ | ✅ | ✅ | partial | partial |
| Pre-built MCP connectors (Gmail, Postgres, shell, …) | ✅ 14 | ❌ user wires their own | ❌ | ❌ | ❌ | ❌ | ❌ |

✅ = present and shipping  ·  partial = exists but narrower than the comparison column  ·  ❌ = not present in current public docs as of writing

### Pick the right tool for the job

These are not mutually exclusive — many teams run two of these together. Use this as a starting frame, not a decree:

- **JAK Shield** is the right fit when **the threat is the tool call itself** — destructive SQL, accidental email to the wrong recipient, an agent that just got prompt-injected by a webpage about to send your customer list to `attacker@evil.com`. If you run agents that touch real systems (Gmail, Postgres, GitHub, shell, browser, payments), and you want a deterministic, signed, self-hosted gateway with full audit trail and human-in-the-loop overrides, this is the shape you want.

- **Anthropic native approvals** is right when **you only use Claude Desktop / Claude Code, you trust the user to read every approval prompt, and your blast radius is your own laptop.** It's free, it's built in, it's enough for a lot of solo use. If you start needing per-tenant policy, audit beyond the desktop log, or anything multi-user — you've outgrown it.

- **Lakera Guard** is right when **the threat is the LLM input/output, not the tool boundary** — chatbots, customer-facing assistants, content moderation at scale. They have ML-trained injection and PII models that catch nuance regex won't. If you're building a chatbot, not an agent, look at Lakera before JAK Shield.

- **Nightfall AI** is right when **the threat is data leaving regulated systems** — SaaS connectors (Slack, Drive, Confluence), email DLP, regulated-industry compliance. Cloud DLP is their core competence. If your job is "stop PII from leaving Slack," Nightfall first.

- **Cloudflare AI Gateway** is right when **you want rate-limiting, caching, observability between your app and OpenAI/Anthropic** — it's an LLM gateway, not a security gateway. Different problem.

- **NeMo Guardrails** is right when **you want a programmable Colang DSL for conversational rails inside a chain**. Open source, NVIDIA-backed, mature. If you're using Python and NeMo's other models, this snaps in.

- **Guardrails AI** is right when **you want declarative LLM-output validators**: "this output must match this Pydantic schema, contain no PII, be < 200 tokens." Different shape — output-side, post-LLM, pre-app.

- **Promptfoo** is right at **build time, not runtime** — eval your prompts and your guardrails against attack corpora. Pairs with JAK Shield: use Promptfoo to test JAK Shield's rules.

### Where JAK Shield is uniquely the only choice

Seven things JAK Shield does that I haven't found in any of the products above as of writing (please open an issue if you find one — the table updates fast):

1. **Cross-call taint tracking with MinHash + n-gram fingerprinting.** Untrusted bytes from `browser.fetch` flow into `gmail.send_email` and JAK Shield notices. No other MCP-layer guardrail I can find does this.
2. **20 multi-step attack-chain patterns with data-flow boost.** Sequence detection across recent tool calls — "recon → exfiltrate," "credential-harvest → external-send," etc. — with the prior call's output substring as an escalation signal.
3. **Block override with heightened-scrutiny window.** Hard-block / soft-block / approve isn't enough. v0.2 adds: overridable blocks surface what + why + worst-case; CRITICAL stay non-overridable; accepting an override tightens thresholds for the next 5–10 calls; one-strike rule on subsequent blocks during the window.
4. **User-controlled pause + auto-resume with mandatory scrutiny on exit.** *(v0.3, new.)* The user can suspend non-CRITICAL blocks for 1–60 min — for migrations, debugging, known-safe windows — but CRITICAL rules still fire even during pause, pause auto-expires (no "indefinite off"), and the session enters heightened scrutiny when pause ends. The pause itself is audit-logged and every suppressed block during the window is logged.
5. **HMAC-signed decisions with key rotation and tamper-evident canonical form.** Every decision is signed; flipping `override.overridable` post-signing invalidates the HMAC (this is tested).
6. **Single-use capability tokens bound to (tenant, tool, args-hash).** Short-lived JWTs you mint after an approval; intercepted tokens can't be replayed.
7. **Regulatory hints with citations + an explicit "not legal advice" disclaimer surfaced inline on every decision.** Most products either say nothing or claim certification. Honest middle ground.

---

## 🧰 The MCP toolbox

JAK Shield exposes **26 `shield.*` security tools** + **14 protected connectors** to any MCP client (`grep -c "name: 'shield\\." packages/mcp-server/src/shield-tools.ts` to verify):

<details>
<summary><b>Shield tools (click to expand)</b></summary>

| Tool | Purpose |
|---|---|
| `shield.evaluate_tool_call` | Policy decision only — no execution |
| `shield.proxy_tool_call` | Decide + execute via connector |
| `shield.explain_decision` | Full evidence tree + signature + compliance hints |
| `shield.scan_input` / `shield.scan_input_v2` | Defense-in-depth scan |
| `shield.scan_output` | Wrap tool output as untrusted |
| `shield.redact_sensitive_data` | PII / secrets redaction |
| `shield.detect_prompt_injection` | 6-stage detector |
| `shield.require_approval` / `check_approval` / `list_pending_approvals` | Approval queue |
| `shield.issue_capability_token` / `verify_capability_token` | Single-use scoped JWTs |
| `shield.taint_snapshot` | Inspect tainted outputs in session |
| `shield.anomaly_snapshot` | Per-tool baseline counters |
| `shield.compliance_tag` | Regulatory framework hints |
| `shield.audit_event` | Custom audit entry |
| `shield.block_action` | Voluntary block + audit |
| `shield.rewrite_safe_action` | Suggest a safer rewrite |
| `shield.list_protected_tools` | Enumerate connectors |
| `shield.override_block` *(v0.2)* | Accept the risk on an overridable block → mints single-use override token + opens scrutiny window |
| `shield.scrutiny_status` *(v0.2)* | Inspect heightened-scrutiny state for the current session — calls remaining, warnings accumulated |
| `shield.stand_down` *(v0.2)* | End the heightened-scrutiny window early (after the override task completes) |
| `shield.pause` *(v0.3)* | Pause JAK Shield for a bounded window (1–60 min, default 15). Suppresses NON-CRITICAL blocks; CRITICAL rules still fire. Required reason ≥ 20 chars. Audit-logged. |
| `shield.resume` *(v0.3)* | End an active pause early. Triggers heightened scrutiny for the next 10 calls. |
| `shield.pause_status` *(v0.3)* | Inspect the active pause state — scope, time remaining, calls observed under pause. |

</details>

<details>
<summary><b>Protected connectors (click to expand)</b></summary>

Filesystem (sandboxed) · Shell (allowlist-gated) · Gmail · GitHub · Supabase · Postgres · Browser fetch · HTTP fetch / POST · Slack · SMS (Twilio) · Google Drive · Outgoing webhook · Social drafts + publish-with-approval.

</details>

---

## 🤝 Community

JAK Shield is built in the open. Come help shape the future of AI agent security.

- 💬 **[GitHub Discussions](https://github.com/inbharatai/jak-shield/discussions)** — primary chat channel; tag the maintainer in any thread
- 🐦 **[X / Twitter — @reetur_aj](https://twitter.com/reetur_aj)** — release news, threat research, build-in-public threads
- 💼 **[LinkedIn — reetur-aj](https://www.linkedin.com/in/reetur-aj)** — for security buyers, CISOs, and adoption conversations
- 🟧 **[Reddit — u/reetur_aj](https://reddit.com/user/reetur_aj)** — long-form posts + community discussion
- 🎮 **Discord — `reetur_aj`** — DM the maintainer directly (no public server yet; ping in [Discussions](https://github.com/inbharatai/jak-shield/discussions) to get added when one launches)
- 📷 **[Instagram — @unigurus](https://instagram.com/unigurus)** — behind-the-scenes + design previews
- 📨 **[info@inbharat.ai](mailto:info@inbharat.ai)** — design partners, enterprise, and responsible-disclosure reports ([SECURITY.md](./SECURITY.md))
- 📖 **[Release notes](https://github.com/inbharatai/jak-shield/discussions/categories/announcements)** — engineering posts + version drops

### #️⃣ Hashtags

When you share, please use:

**Topic:** `#MCP` `#AISafety` `#AIagents` `#LLMSecurity` `#PromptInjection` `#AgentSecurity` `#AIFirewall` `#AIGuardrails`

**Product:** `#JAKShield` `#OpenSourceSecurity` `#DLP` `#ZeroTrustAI`

**Communities:** `#ClaudeAI` `#OpenAI` `#Cursor` `#BuildInPublic` `#OpenSource` `#Cybersecurity` `#AppSec` `#DevSecOps`

---

## 🛠️ Contributing

We love contributions. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and pick an issue tagged `good first issue` or `help wanted`.

**Most-wanted contributions:**

| Area | Skill | Reward |
|---|---|---|
| 🌐 New language for injection detection | regex + native speaker | listed in [`HALL_OF_FAME.md`](./HALL_OF_FAME.md) |
| 🩺 New PII type with checksum validator | math + regex | same |
| 🔌 New protected connector (any API) | TypeScript | same |
| 🎯 New adversarial benchmark scenario | creativity | same |
| 🧪 Mutation testing setup | Stryker / similar | bounty (see Discord) |
| 🤖 Fine-tuned injection classifier | ML + open corpus | bounty + co-author paper |
| 📊 Public head-to-head benchmark vs Lakera / Nightfall | research | bounty + blog co-author |

---

## 🗺️ Roadmap

- [x] **Q1 2026 — Phase 1:** MCP security core + deterministic policy engine
- [x] **Q1 2026 — Phase 2:** 13 protected connectors + dashboard
- [x] **Q1 2026 — Phase 3:** Multi-tenant SaaS foundation (auth · API keys · billing)
- [x] **Q1 2026 — Phase 3b:** v2 detectors · taint · chains · anomaly · capability tokens
- [x] **Q2 2026 — Phase 4a:** v0.2 — block override + heightened scrutiny, signed override fields
- [ ] **Q2 2026 — Phase 4b:** OAuth / SSO · public head-to-head benchmark
- [ ] **Q3 2026 — Phase 4c:** SOC 2 Type I (engagement contingent on first regulated customer — see [`docs/SOC2_ROADMAP.md`](./docs/SOC2_ROADMAP.md))
- [ ] **Q2 2026 — Phase 5:** ML-trained injection classifier · embedding-based taint similarity
- [ ] **Q3 2026 — Phase 6:** Hosted SaaS GA · enterprise pilots · compliance certifications
- [ ] **2026+:** ISO 27001 · HIPAA BAA · FedRAMP · industry policy packs

Track issues with the [`roadmap`](../../labels/roadmap) label.

---

## 💖 Sponsors

JAK Shield is free and open-source. If your company benefits, please consider [sponsoring](https://github.com/sponsors/inbharatai) to fund:

- Independent security audits (next: H2 2026)
- ML-classifier training on a labeled injection corpus
- Public benchmark methodology + leaderboard
- Bug bounty pool

---

## 📚 Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — the engine, end to end
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — Render · Fly · Vercel · Docker · k8s
- [`docs/AUDIT.md`](./docs/AUDIT.md) — honest self-audit of every claim
- [`docs/QUICKSTART.md`](./docs/QUICKSTART.md) — 5-minute walkthrough
- [`configs/mcp/`](./configs/mcp) — copy-paste configs for every client
- [`bench/scenarios.json`](./bench/scenarios.json) — the 45-scenario adversarial corpus

---

## 📜 License

[MIT](./LICENSE) — Copyright (c) 2026 JAK Shield contributors

> If you build a commercial fork: that's allowed under MIT, but we'd love to hear about it on Discord.

---

## 🙏 Acknowledgements

JAK Shield's PII patterns + RBAC primitives were lifted from the [JAK Swarm](https://github.com/inbharatai/jak-swarm) project. The MCP wire protocol comes from [Anthropic's spec](https://modelcontextprotocol.io). The bench methodology was inspired by [Lakera's research blog](https://www.lakera.ai/blog).

---

<div align="center">

**Built in the open · MCP-native · Less than 1 ms per decision**

[⭐ Star this repo](../../) if JAK Shield saved your agent from doing something stupid.

`#MCP` · `#AISafety` · `#PromptInjection` · `#AgentSecurity` · `#OpenSource` · `#BuildInPublic`

</div>
