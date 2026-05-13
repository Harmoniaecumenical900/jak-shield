# Welcome — what JAK Shield is, what it isn't, and how to help

Hi all 👋

JAK Shield is a security gateway that sits between any MCP-compatible AI client (Claude Desktop, Cursor, VS Code, OpenAI Agents SDK, Cline, Continue, Windsurf, Zed, Goose…) and the real tools the agent calls. Adapters extend the same engine to ChatGPT Custom GPTs, Gemini, LangChain, CrewAI, Vercel AI SDK, and Pydantic AI.

Every tool call goes through a deterministic policy pipeline before it touches Gmail, Postgres, GitHub, shell, or anything else. If it's risky, it gets blocked, redacted, queued for human approval, or rewritten into a safer alternative — and every decision is HMAC-signed and audit-logged.

## What's actually in v0.1.0

- 8 deterministic policy rules + RBAC + approval queue
- 28 PII types with cryptographic checksum validators (Luhn / Verhoeff / mod-97 IBAN / ABA / mod-11 NHS / CPF / CNPJ / SIN / NRIC / TFN / EIN / SWIFT / Bitcoin / Ethereum + more)
- 6-stage prompt-injection detection: regex + structural + Unicode confusables + base64/hex + spaced-letter de-spacing + multilingual (13 non-English languages plus English baseline)
- Cross-call taint tracking with MinHash + n-gram fingerprinting — caught data flowing between tool calls in our adversarial bench, not aware of any other MCP gateway that does this
- 20 attack-chain patterns with data-flow analysis + time-decay weighting
- EWMA + z-score behavioural anomaly detection, multi-window, per-tenant + per-agent
- Short-lived, single-use, scope-bound capability tokens (JWT-shaped, HMAC-signed)
- HMAC-SHA256 signed decisions with key rotation
- Regulatory hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA) with citations + an explicit "this is not legal advice" disclaimer
- 45-scenario adversarial benchmark passing 45/45 in CI
- p95 evaluation latency ~2.3 ms on a developer laptop (single tool call, in-process, no network)

## What it isn't

- **Not a substitute for a lawyer.** The compliance hints are hints. The disclaimer in the code is real and matters.
- **Not benchmarked head-to-head against Lakera Guard or Nightfall AI.** I have not run a like-for-like comparison and won't claim to have. JAK Shield has a different shape: it's MCP-native, runs in-process or as a sidecar you control, is open source, and lets you read every line of every rule. That doesn't make it better at every job — it makes the comparison apples-to-oranges.
- **Not battle-tested at scale.** v0.1.0 is day zero of public use. The test suite is broad (130 unit + integration tests across the engine, DLP, prompt-shield, observability, and end-to-end) and the bench is real, but production wear-in only comes from production.
- **Not a magic AI moderator.** The OpenAI classifier is an *advisor* that runs in parallel with the deterministic engine on a 1.5 s timeout. If the API is down, missing a key, or slow, the deterministic engine still produces the decision. Tests assert this.

## What I'd love help with

1. **Try it and tell me where it breaks.** `npx @jak-shield/mcp-server` or grab the `.mcpb` from the release page for one-click Claude Desktop install. Adversarial payloads especially welcome — file an issue with the payload that slipped through.
2. **Write a connector.** The template is at `packages/connectors/_template/`. Anything you wish was protected (Notion, Linear, Stripe Test, AWS, Vercel, Sentry…) is fair game.
3. **Translate the injection patterns.** I covered 13 non-English languages; native speakers will catch nuances I missed. Patterns live at `packages/prompt-shield/src/patterns-extended.ts`.
4. **Stress the policy engine.** If you can write a tool call that should have been blocked and wasn't (or was blocked and shouldn't have been), open an issue — those are gold.
5. **Reviewer for the dashboard.** Next.js 15, Server-Sent Events for the approval queue. I'd value a UX pass.

## Ground rules for this space

- **Honest disagreement is welcome.** If a claim in the README is wrong, say so. I've already corrected the language count once after a contributor pushed back, and I expect more of that.
- **Security issues go to `security@` or a private security advisory, not here.** See `SECURITY.md`.
- **No "this is better than X" without numbers.** I don't make those claims and won't accept PRs that add them.
- **MIT means MIT.** Fork it, ship it, sell it. The only thing I ask is that if you find a real vulnerability, you tell me before you tell the internet.

Looking forward to seeing what you build.

— reetu / `inbharatai`
