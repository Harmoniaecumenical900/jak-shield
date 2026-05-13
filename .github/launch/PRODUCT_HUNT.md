# Product Hunt launch draft

PH wants a name, tagline, description, gallery, makers, topics. Below is the full submission ready to paste.

---

**Product name:** JAK Shield

**Tagline (60 chars max):**

> Universal security gateway for AI agents — open-source, MCP-native

**Description (260 chars max for the listing preview):**

> JAK Shield sits between any AI agent (Claude, OpenAI, Cursor) and the real tools it calls. Blocks destructive actions, redacts PII across 28 types, detects prompt injection in 13 non-English languages plus English, tracks taint, requires approval. Open-source. < 1 ms per decision.

**First comment (this is the most important field on PH — under 1000 chars):**

> Hey Product Hunt 👋
>
> I built JAK Shield because AI agents in 2026 have the power to send email, query databases, and run shell commands — without ever asking a human first.
>
> JAK Shield is a security gateway that intercepts every tool call from any MCP-compatible AI client (Claude Desktop, OpenAI Agents SDK, Cursor, VS Code) and decides: allow, redact, require approval, or block.
>
> What's in it today:
> 🛡️ Deterministic policy engine (8 built-in rules)
> 🩺 PII detection across 28 types with checksum validators
> 🧬 6-stage injection detection across 13 non-English languages plus English
> 🧲 Cross-call taint tracking (novel for MCP)
> 🔐 HMAC-signed decisions, capability tokens, audit trail
> 📊 ~2.3 ms p95 latency, 45/45 adversarial benchmark
>
> 100% open-source MIT. Available right now via one command for Claude Desktop.
>
> What I'd love most: send me adversarial inputs you think will evade it. I'll add them to the benchmark and credit you.

**Topics to select:**

- Developer Tools
- Open Source
- Security
- Artificial Intelligence
- Productivity (secondary)

**Galley (4 images recommended):**

1. The SVG banner from `.github/assets/jak-shield-banner.svg` (render to PNG at 1280×640)
2. A screenshot of the dashboard `/approvals` page with a pending decision
3. The benchmark output (`pnpm bench`) terminal screenshot
4. The architecture mermaid diagram from README rendered as a PNG

**Maker bio:**

> Builder of JAK Shield and JAK Swarm. Focused on what happens when AI agents acquire real-world capability. Open-source by default.

---

## Posting tactics

- **Launch on Tuesday or Wednesday**, midnight Pacific. PH days reset at 00:00 PT.
- Get 5-10 friends to upvote within the first hour (PH algorithm weights early velocity).
- Reply to every comment within 1 hour for the first 12 hours.
- DM 20 makers you know the day before; ask for honest reactions on the draft, not for upvotes.
- Don't post on a holiday or a major industry conference day.
- Have a 90-second product video ready (Loom / YouTube unlisted) and link it in the first comment.
- Cross-post the launch to Twitter, LinkedIn, Discord — and link back to the PH page so commenters know where to engage.
