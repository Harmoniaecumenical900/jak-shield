# Reddit launch posts

Three subs, three different angles. Read each sub's rules before posting. Reddit hates anything that looks like marketing — be conversational, lead with the problem.

---

## r/LocalLLaMA

**Title:**

> I open-sourced a security firewall for MCP tool calls — 12-language injection detection, taint tracking across calls, < 1 ms p95

**Body:**

If you're running Claude Desktop / OpenAI Agents SDK / Cursor with MCP servers wired up, your agent has the literal capability to send email, query Postgres, run shell commands, post webhooks. Most of us are running these locally with zero guardrails.

I spent the last few months building JAK Shield — an MCP-native gateway that sits between your agent and the real tools. Every tool call is intercepted, scanned, and either allowed / redacted / approved / blocked. 1 ms latency, deterministic policy engine, full open source.

**Three things I haven't seen elsewhere for MCP:**

1. **Taint tracking with MinHash.** When `browser.fetch` returns content from a URL, that content gets fingerprinted. If a later `gmail.send_email` body contains a paraphrased version of that content (Jaccard ≥ 0.30 over 4-token shingles), it's flagged. Stops the "agent reads a malicious webpage, then forwards it externally" attack class even when the agent summarizes it.

2. **Capability tokens.** Short-lived (60 s default), single-use JWTs scope-bound to one specific tool + args hash. Intercepting one is useless after one second.

3. **Multi-stage injection detection across 13 non-English languages plus English.** Cyrillic confusables, base64-decoded payloads, HTML-comment-hidden instructions, Russian / Chinese / Hindi / Arabic all caught by separate detector stages.

**Bench:** 45/45 adversarial scenarios pass. Repo includes the benchmark JSON, the runner, and a perf SLO check (p95 < 50 ms enforced in CI; actual measured ~2.3 ms).

Open-source MIT. Works with Claude Desktop today via one command. Repo + install + docs: https://github.com/inbharatai/jak-shield

Happy to take adversarial inputs — if you can evade the detectors I'll fix and credit you in `HALL_OF_FAME.md`.

---

## r/programming

**Title:**

> Show /r/programming: Open-source MCP security gateway with checksum-validated PII detection and taint tracking

**Body:**

TypeScript / pnpm monorepo. 32 packages. 130 tests. 45-scenario adversarial benchmark in CI.

The architectural decision I'd love feedback on: should the policy engine sit between the agent and the tool (where I put it) or between the LLM API and the agent? Most AI-security products go the second route (Lakera, NeMo). I argue the first is the right place because that's where capability is acquired — but I'm curious if anyone has a counter.

Engineering highlights:

- Deterministic policy engine; the OpenAI classifier is an advisor only and never overrides a hard block
- Decisions are HMAC-signed (with key-rotation slot for `JAK_SHIELD_DECISION_HMAC_PREVIOUS`)
- Boot-time refusal if `NODE_ENV=production` is set with a dev secret
- Taint tracking via MinHash with 32-dim signatures, Jaccard threshold 0.30
- All 130 tests run in < 5 s; full clean rebuild + tests + bench in < 90 s

Repo: https://github.com/inbharatai/jak-shield

Honest part: no SOC 2, no pen-test, zero customers. Pre-customer by design — wanted the code in the open first.

---

## r/cybersecurity

**Title:**

> Open-source attempt at filling the AI-agent security gap (MCP gateway, taint tracking, 20 attack-chain patterns)

**Body:**

Hi /r/cybersecurity — looking for honest blue-team eyeballs on this.

AI agents in 2026 have real-world capability through MCP (Anthropic's tool protocol, also adopted by OpenAI and others). Most agent deployments I see in the wild have zero gating between the agent and the tools — agent decides, agent acts. Lakera and NeMo focus on the LLM-call boundary; nobody serious is at the MCP tool-call boundary yet.

I built JAK Shield to live at that boundary. Open-source MIT, ~7000 LoC TypeScript.

Threat model + what it actually defends against, honestly:

- Defends against: agent over-reach (sending PII externally), destructive SQL/shell, RAG-poisoning chains, cross-call exfiltration (`browser.fetch → gmail.send_email`), credential harvest (`filesystem.read .env → webhook.send`)
- Doesn't defend against: compromised JAK Shield deployment, embedded model misalignment, embedding-inversion side channels, novel injection attacks not in the pattern set

Detector mix is intentionally heuristic-first (regex + checksum validators + structural parse + Unicode normalization + multi-language) with the OpenAI classifier as advisor. Rules-first because regulated buyers want to read the regex.

Repo: https://github.com/inbharatai/jak-shield

Specifically asking: anyone here run an MCP server in prod? What's your gating story today? What attack class would you most like the next adversarial benchmark scenario to cover?
