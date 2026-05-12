# Medium / Substack / dev.to launch article

Long-form. ~1800 words. Use this as the "deep" launch piece — link to it from every short-form post (Twitter, Reddit, LinkedIn).

---

# Why I built JAK Shield: a security gateway for the MCP-tool-call boundary

*Published 2026-05-11. Author: [your name]. Cross-posted to dev.to and Substack.*

---

## The shape of the problem

In 2026, an AI agent on your laptop probably has access to:

- Your Gmail (read + send)
- Your GitHub (read + write + merge)
- Your Postgres (query + mutate)
- Your shell (any allowlisted command)
- Your browser (fetch any URL)
- Your filesystem (read + write + delete inside a sandbox, or anywhere it can reach)
- Your Slack (post to any channel)
- A long tail of MCP servers you wired up over the last six months

That's not theoretical. That's the default configuration of Claude Desktop with three or four MCP plugins installed. Or Cursor with a handful of integrations. Or the OpenAI Agents SDK with the connectors that ship in their cookbook.

And yet: there is no firewall on the tool-call boundary. The agent decides what to do; the tool runs; nobody asked.

Compare to the LLM-API boundary, where products like Lakera Guard, NeMo Guardrails, and Cloudflare AI Gateway already sit. There's good thinking happening on what the model says. Almost no thinking on what the agent does.

JAK Shield is my attempt to fill the second gap.

## What it does

JAK Shield is an MCP-native gateway. Every tool call from any MCP-compatible AI client passes through it. The gateway runs a deterministic 10-stage decision pipeline and emits one of five outcomes:

1. **allow** — proceed to the real connector
2. **block** — refuse, audit, return a `safe_alternative` suggestion
3. **requires_approval** — enqueue for human review
4. **redact** — strip PII / secrets from the args, then proceed
5. **rewrite** — return a safer alternative phrasing the agent should re-issue

The pipeline order (which matters more than people think):

1. Hard rules (block-only)
2. Multi-stage injection detection on input
3. Offensive cyber heuristic
4. Taint check against previous tool outputs
5. Cross-call attack-chain detection
6. Soft rules (approval / redact)
7. PII / secrets scan with checksum validators
8. Anomaly detection (EWMA + z-score)
9. RBAC
10. Risk-class threshold
11. (Optional) OpenAI classifier as advisor — never overrides a hard block

Each stage emits structured evidence. The final decision carries a full evidence tree, an HMAC signature, and compliance hints. p95 latency end-to-end: 0.64 ms.

## Three pieces I'm proud of

### 1. PII detection with cryptographic validators

Regex alone is famously bad at PII. "1234567812345678" might be a credit card or it might be a confirmation code. Adding the Luhn checksum kills 90% of those false positives.

I added validators for:

- Luhn (credit cards, IMEI, SIN)
- Verhoeff (Aadhaar)
- mod-97 (IBAN)
- ABA weighted-sum (US routing numbers)
- mod-11 (NHS UK)
- CPF / CNPJ (Brazil)
- TFN (Australia)
- PAN (India format-only)
- NRIC (Singapore)
- SSN block-list (rejects invalid area/group/serial)
- Bitcoin / Ethereum format
- SWIFT/BIC
- IPv6

Plus context-window confidence scoring. If "SSN" appears within 40 characters of a 9-digit number, confidence jumps from 0.6 to 0.85. If no keyword is nearby and base confidence is < 0.6, the finding is dropped.

This is not state-of-the-art compared to Nightfall's ML-trained detectors. But it's open-source, deterministic, and you can read the regex.

### 2. Taint tracking across tool calls

This is the part I think is genuinely novel for MCP.

When `browser.fetch` returns a body of text, that body is tokenized, n-gram-shingled (4-token windows), and fingerprinted via MinHash (32 dimensions). The signature is stored against the session.

When any subsequent tool call has args whose content overlaps the stored signature (Jaccard ≥ 0.30), the call is flagged. If the target is in the `SENSITIVE_SINKS` list (Gmail, Slack, SMS, webhook, HTTP POST, public DB writes, GitHub issues), it requires approval.

This catches the most underrated MCP attack pattern: the agent reads a webpage that contains an injection, then summarizes the page into an email. Substring matching misses it. MinHash catches it.

It's not perfect — a 70%+ rewrite of the content will evade. Embedding-based similarity would close that gap, but I wanted to ship the regex-and-math version first because it's verifiable.

### 3. Capability tokens

Standard pattern, applied to a new context. When the agent plans a sensitive call, JAK Shield can issue a JWT bound to:

- tenant id
- exact tool name
- args hash (canonical-stable)
- jti (single-use id)
- exp (60 s default)

HMAC-SHA256 signed. The connector verifies the token immediately before execution. After verify, the jti is burned in a memory-bounded set.

Result: intercepting a capability token gets you exactly one specific call within 60 seconds. Not "send any email." Not "send to any address." That one email, to that one address, with that one body. Then the token is dead.

This is what bearer-token security should have looked like all along.

## What it isn't, honestly

I'm going to write this section the way I wish every security product wrote it.

**Not SOC 2 certified.** Pre-customer by design. SOC 2 Type I is on the H2 2026 roadmap. Until then, do not deploy this to a regulated workload without your own security review.

**Not "better than Lakera."** Lakera has a research team and a fine-tuned model on a labeled injection corpus. I have heuristics and regex across 13 non-English languages plus English. On novel adversarial prompts they likely win on recall. On determinism, transparency, and audit trail, JAK Shield wins. Different shape, different trade-off.

**The compliance module emits hints, not classifications.** PCI, HIPAA, GDPR, SOX, FERPA, DPDP signal detection. Every result includes a confidence score, a CFR / GDPR article citation, and an explicit disclaimer that says "this is triage; a qualified officer must confirm scope." I will not let "JAK Shield is HIPAA compliant" be in the marketing.

**Zero customers.** That's both the honest truth and a feature: I wanted the code in the open before I tried to sell anything.

**Pre-customer benchmarks.** The 45-scenario adversarial benchmark in the repo is one I wrote myself. Passing your own homework isn't a benchmark — it's a regression suite. The first thing I want from the community is novel adversarial inputs that evade the current detectors.

## What I'd love from the community

Specifically:

1. **Adversarial inputs that evade the v2 detectors.** Open a `detector-miss` issue. I'll fix and credit you in `HALL_OF_FAME.md`.
2. **A new language for injection detection.** Hindi, Mandarin, Arabic, Russian are in; we need Bengali, Swahili, Indonesian, Brazilian Portuguese street-speech, French Canadian.
3. **A new PII type with a checksum validator.** Especially national ID schemes I don't know about.
4. **A new attack-chain pattern.** Especially if you've seen it in the wild.
5. **A public head-to-head benchmark against Lakera / Nightfall.** I can't do this myself credibly. A neutral third party with access to both APIs could.

The repo is MIT. The roadmap is in `README.md`. Discord is at discord.gg/jakshield. Email me at hello@jakshield.ai if you want to be a design partner for the enterprise version (SOC 2 / SSO / IP allowlists / custom policy packs).

## Why open source

Three reasons.

**Trust.** Security tools that you can't read the source of are asking you to trust the vendor on faith. I'd rather earn trust by being readable.

**Adoption.** The MCP ecosystem is moving fast. The product that's `git clone`-able will win the next 18 months.

**Defense.** The MCP attack surface is brand new. Nobody has the right pattern set yet. I'd rather a security researcher fork the repo, find a flaw, and publish a patch than have them sit on a 0-day for the closed-source competitor.

If this resonates: star the repo, share with one teammate, send me an adversarial input.

— [your name], 2026-05-11

---

**Tags:** `ai-safety` `llm-security` `mcp` `prompt-injection` `open-source` `security` `agent-security` `dlp` `compliance` `build-in-public` `claude` `openai` `cursor` `typescript`

**Repo:** https://github.com/inbharatai/jak-shield
**Discord:** https://discord.gg/jakshield
**Twitter:** https://twitter.com/jakshield
