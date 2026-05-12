# Show HN draft

**Title (80-char limit on HN):**

> Show HN: JAK Shield — open-source MCP security gateway for AI agents

**Alt titles to A/B:**

- Show HN: Block your AI agent from sending PII or running rm -rf — open-source MCP
- Show HN: 1ms p95 security gateway for Claude/OpenAI/Cursor tool calls
- Show HN: I built a security firewall for MCP tool calls; 45/45 adversarial bench

---

**Body:**

Hi HN — I built JAK Shield, an open-source security gateway that sits between any MCP-compatible AI client (Claude Desktop, OpenAI Agents SDK, Cursor, VS Code) and the real tools those agents call.

The pitch in one sentence: every tool call passes through Shield first, where a deterministic policy engine blocks destructive actions, redacts PII, detects prompt injection, requires human approval for risky ops, and writes a tamper-evident audit log — in under 1 ms.

**What's in it today:**

- 8 built-in policy rules (dangerous shell, dangerous SQL, external-email PII, prod deploy, payments, social publish, fs sandbox, browser denylist)
- PII detector with 28 types and cryptographic checksum validators (Luhn for credit cards, Verhoeff for Aadhaar, mod-97 for IBAN, mod-11 for NHS, etc.)
- Injection detector with 6 stages: standard regex, structural HTML/JSON, Unicode confusables, base64/hex/percent decode, spaced-letters, multilingual (12 languages)
- **Taint tracking** — MinHash + n-gram fingerprinting so paraphrased/reformatted text from a prior `browser.fetch` is detected when it flows into an outbound channel. I haven't seen this anywhere else for MCP.
- **Capability tokens** — 60s, single-use, args-bound JWTs so an intercepted token is useless beyond one specific call
- **Attack-chain detection** — 20 multi-step patterns with data-flow tracking (output of step N appearing in args of step N+1 escalates the chain match)
- HMAC-signed decisions with key rotation, full evidence-tree provenance, regulatory hints (PCI/HIPAA/GDPR/SOX/FERPA/DPDP with CFR/article citations and explicit "this is not legal compliance" disclaimer)
- Prometheus metrics, rate limiting, circuit breakers, fail-boot in production with dev secrets
- 147 unit + security tests, 45/45 adversarial benchmark, p95 latency 0.64 ms

**What's explicitly NOT claimed:**

- It is not "better than Lakera" — they have ML-trained models we don't. We never measured head-to-head.
- Not SOC 2 certified.
- The compliance module emits triage signals, not legal classifications.
- Zero customers — fully open-source, pre-revenue.

**Where the open question is:**

Most AI security tools (Lakera, NeMo, Nightfall) sit in front of the LLM API. JAK Shield sits between the agent and the tools — a different shape. I think the MCP tool-call boundary is the right place for security because that's where the agent acquires real-world capability. Curious if HN agrees.

Repo + 45-scenario benchmark + perf SLO check in CI: https://github.com/inbharatai/jak-shield

Happy to answer anything. Especially adversarial inputs you think might evade the detectors — I'll add them to `bench/scenarios.json` and credit you.

---

**Posting tips for HN:**

- Post Tuesday or Wednesday, 8-11 am Pacific.
- Don't use hashtags in the title.
- First comment from you should be the most-asked technical question pre-empted.
- Reply to every comment within the first 3 hours.
- Don't ask for upvotes anywhere.
