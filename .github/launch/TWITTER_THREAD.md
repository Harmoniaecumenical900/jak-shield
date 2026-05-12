# Twitter / X launch thread

11 tweets. Numbered + drafts only — copy/paste, edit your handle and the screenshot/GIF placeholders.

Hashtags at the end of each tweet are intentional — Twitter rewards them in 2026's algo.

---

**1/11 — hook**

Today I'm shipping JAK Shield — an open-source security gateway that sits between any AI agent (Claude, OpenAI, Cursor) and the real tools it calls.

Every tool call blocked, redacted, or audited before it touches the real world.

In < 1 ms. 🧵

#MCP #AISafety #BuildInPublic

---

**2/11 — the problem**

In 2026 every AI agent has the power to:
  • send email
  • query Postgres
  • run shell commands
  • post to Slack
  • move money

Nobody asks first.

One prompt injection in a webpage → one `DROP TABLE` → one leaked SSN → one bad day.

#PromptInjection #LLMSecurity

---

**3/11 — what JAK Shield does**

Sits at the MCP tool-call boundary. 10-stage decision pipeline:

⚡ Block destructive SQL / shell
🩺 Redact PII (28 types + checksums)
🧬 Detect injection (6 stages, 12 languages)
🧲 Track taint across calls
🔗 Detect attack chains
✋ Require human approval

#AgentSecurity

---

**4/11 — the novel parts**

Three things I haven't seen anywhere else for MCP:

1. Taint tracking via MinHash — paraphrased webpage content flowing into outbound channels gets flagged
2. Capability tokens — 60 s, single-use, args-bound JWTs
3. Cross-call attack-chain detection — 20 patterns + data-flow tracking

#OpenSource #AIFirewall

---

**5/11 — the benchmark**

📊 45/45 on a labelled adversarial corpus
📊 147 unit + security tests passing
📊 p95 decision latency: 0.64 ms
📊 Throughput: 2 178 dec/sec on stock CPU

CI enforces a 50 ms p95 SLO. Current margin: 77×.

The bench JSON ships in the repo — bring your evasions.

#Benchmark #Performance

---

**6/11 — the honest part**

What I'm NOT claiming:

❌ Not "better than Lakera/Nightfall" — never measured head-to-head
❌ Not SOC 2 certified
❌ The compliance module emits hints, not legal classifications
❌ Zero customers — pre-revenue, open-source first

What IS true: the engine is fast, signed, modular, and runs end-to-end in < 1 ms.

#TransparentBuild

---

**7/11 — installs in 1 minute**

```bash
git clone github.com/inbharatai/jak-shield
cd jak-shield && pnpm install && pnpm build
node scripts/install-claude-desktop-mcp.mjs
```

Restart Claude Desktop. Ask: "What jak-shield tools do you have?" → 38 tools.

#ClaudeAI #DevTools

---

**8/11 — works with**

Designed MCP-native. Works today with:

🟪 Claude Desktop
🟢 OpenAI Agents SDK
🟦 Cursor
🟥 VS Code
🐙 JAK Swarm (separate project, same author)
⚡ Any MCP client speaking stdio or HTTP

Configs are pre-built in `configs/mcp/`.

#OpenAI #Cursor #VSCode

---

**9/11 — built in the open**

Repo is MIT, public, ships with:

📁 29 packages, 7000+ LoC TypeScript
📁 45-scenario adversarial benchmark
📁 Architecture doc, deployment doc, honest self-audit
📁 GitHub Actions CI on every push
📁 Docker Compose for the full SaaS stack

#OpenSourceSecurity #BuildInPublic

---

**10/11 — community**

If you want to help:

💬 Discord: discord.gg/jakshield
🐦 Follow: @jakshield
⭐ Star: github.com/inbharatai/jak-shield
🎯 Adversarial inputs: open an issue tagged `detector-miss` — I'll fix + credit you

Most-wanted contributions in `CONTRIBUTING.md`.

#OpenSource #Community

---

**11/11 — call to action**

If you're running an AI agent in production without a security gateway: that's the bet.

If you want to stop making that bet: jakshield.ai

If you want to help build it: discord.gg/jakshield

Day 1 of building this in public.

#AISafety #JAKShield #MCP #PromptInjection #AgentSecurity

---

## Posting strategy

- Post Wed/Thu, 9am Pacific / 12pm Eastern.
- First reply: pin a follow-up with the demo GIF (Claude blocking `DROP TABLE` in real time).
- Reply to every quote-tweet within the first 4 hours.
- Tag @AnthropicAI, @OpenAIDevs, @Cursor_AI, @LangChainAI in tweet 8 if you want eyeballs from those orgs — but only after the thread has organic traction.
- Pin tweet 1.
- Re-share tweet 5 (the benchmark) as a standalone tweet 24 h later with the screenshot.

## Single-tweet alternatives

If you don't want a thread:

> Shipped JAK Shield today — open-source MCP security gateway for AI agents.
>
> Blocks DROP TABLE, redacts PII, detects injection in 12 languages, all in 0.64 ms p95.
>
> 45/45 adversarial benchmark. MIT.
>
> github.com/inbharatai/jak-shield
>
> #MCP #AISafety #PromptInjection #BuildInPublic
