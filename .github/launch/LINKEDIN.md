# LinkedIn launch post

Audience: security buyers (CISO, AppSec lead, platform engineer), enterprise architects, AI builders at companies. Different tone than Twitter — more professional, more "why this matters for your org."

---

🛡️ Today I'm open-sourcing JAK Shield — a security gateway for AI agents.

Quick reality check for any company running AI agents in 2026:

Your agents have real-world capability. They send email, query databases, run shell commands, post to Slack, move money. Most of them, in most deployments, do this without asking a human first.

That's a posture problem. It's a compliance problem. And it's a credibility problem with your CISO.

JAK Shield sits at the MCP tool-call boundary — between the agent and the real tool — and gates every single call.

What it does:

🔒 Deterministic policy engine — 8 built-in rules, fully open-source. No black-box ML deciding what your agent can do.

🩺 PII detection — 28 identifier types (SSN, Aadhaar, IBAN, credit cards, PAN, NRIC, IPv6, crypto wallets, …) with cryptographic checksum validation. No more "the regex matched but it wasn't actually a credit card" false positives.

🧬 Prompt-injection detection across 12 languages. Catches Cyrillic confusables, base64-encoded payloads, HTML-comment-hidden instructions, multilingual jailbreaks.

🧲 Cross-call taint tracking. If `browser.fetch` returns content from an untrusted URL and a later `gmail.send_email` body contains a paraphrased version, we flag it. Most security tools miss this entirely.

🔗 Attack-chain detection. 20 multi-step attack patterns with data-flow analysis. Read sensitive file → POST webhook? Flagged.

✋ Human-in-the-loop approval queue for risky actions, with a real dashboard.

📜 Regulatory hints for PCI / HIPAA / GDPR / SOX / FERPA / DPDP — with explicit "this is triage, not legal certification" disclaimer.

🔐 HMAC-signed decisions with key rotation. Tamper-evident audit trail your compliance team can verify.

📊 Prometheus metrics, rate limiting, circuit breakers, fail-boot on dev secrets in production.

Performance: 0.64 ms p95 per decision. 2 178 decisions per second on stock CPU. 45/45 adversarial benchmark scenarios pass.

I'll be candid about what JAK Shield is NOT today:

❌ Not SOC 2 certified yet — pre-customer by design.
❌ Not "better than Lakera or Nightfall" — they have ML-trained models we don't, and we haven't run a head-to-head. Different shape: MCP-native, deterministic, fully open.
❌ No managed cloud option yet — that's H2 2026.

If you're a CISO or security lead at a company already running AI agents and you'd like to be a design partner for the enterprise version (SOC 2, SSO, IP allowlisting, custom compliance packs), please reach out: hello@jakshield.ai

If you're an engineer who wants to use it today: github.com/YOUR_GH_HANDLE/jak-shield. One-command install for Claude Desktop, Cursor, VS Code, or OpenAI Agents SDK.

If you want to contribute: Discord at discord.gg/jakshield. Most-wanted PRs in CONTRIBUTING.md.

Day 1 of building this in public.

#AISafety #AISecurity #MCP #LLMSecurity #PromptInjection #CISO #AppSec #DevSecOps #OpenSource #BuildInPublic #ZeroTrustAI #DLP #Compliance #SOC2 #HIPAA #GDPR #DPDP
