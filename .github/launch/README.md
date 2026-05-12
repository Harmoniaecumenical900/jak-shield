# JAK Shield launch comms — checklist + assets

Everything you need to launch v0.1.0. Read top-to-bottom, then execute the day-by-day plan.

## Day −7 → −1 (pre-launch)

- [ ] Buy `jakshield.ai` + `jakshield.com` (or your handle equivalent)
- [ ] Register Twitter / X handle `@jakshield`
- [ ] Set up Discord server with channels: `#welcome`, `#announcements`, `#contributors`, `#bench-misses`, `#deploy-help`, `#general`
- [ ] Open an open-collective or GitHub Sponsors page
- [ ] Set up `hello@`, `security@`, `conduct@`, `bounty@` email aliases
- [ ] Record a 90-second demo screencast (Loom or YouTube unlisted): Claude blocking `DROP TABLE` in real time, the dashboard showing the approval queue, the perf bench output
- [ ] Get 5 friendly reviewers to give the README a sanity-read
- [ ] Make a simple landing page at jakshield.ai (Carrd or Vercel deploy of the dashboard)
- [ ] Test that the one-line install works on a fresh machine
- [ ] Tag the release commit: `git tag -a v0.1.0 -m "JAK Shield 0.1.0"`

## Day 0 (launch day)

Pacific time, in order:

- [ ] **00:00 PT** — Product Hunt goes live (use `PRODUCT_HUNT.md` draft)
- [ ] **06:00 PT** — Tweet 1 of the [Twitter thread](./TWITTER_THREAD.md). Pin it.
- [ ] **07:00 PT** — DM 20 friendly makers / engineers asking for honest feedback (NOT for upvotes)
- [ ] **08:00 PT** — Post [Show HN](./SHOW_HN.md). Stay glued to comments for 4 hours.
- [ ] **08:30 PT** — Post the [LinkedIn](./LINKEDIN.md) version
- [ ] **10:00 PT** — Post to [r/LocalLLaMA](./REDDIT.md)
- [ ] **12:00 PT** — Post the [Medium / dev.to](./MEDIUM_BLOG.md) long-form piece, link it from Twitter + LinkedIn
- [ ] **14:00 PT** — Post to [r/programming](./REDDIT.md)
- [ ] **16:00 PT** — Post to [r/cybersecurity](./REDDIT.md)
- [ ] **18:00 PT** — Re-share Twitter thread quote-tweeting the best HN comment
- [ ] **21:00 PT** — Wrap-up tweet: stars, comments, what landed, what surprised you

## Day +1 to +7

- [ ] Reply to every issue + PR within 24 hours
- [ ] Write up the top 3 questions from launch day into a `FAQ.md`
- [ ] Add any adversarial inputs reported during launch to `bench/scenarios.json` (with credit)
- [ ] Tweet a "Day 2 / Day 3 / …" thread with: stars, contributors, mentions, what shipped
- [ ] If a hot benchmark issue lands, schedule a live stream / Twitter Space to address it

## Day +14

- [ ] Write a "Week 1 in numbers" post (stars, downloads, issues, contributors, top adversarial input)
- [ ] Open Smithery.ai submission
- [ ] Open PR to awesome-mcp-servers
- [ ] Reach out to 5 newsletters (Software Lead Weekly, TLDR Newsletter, AI Tidbits, etc.)

## Day +30

- [ ] Cut v0.1.1 with the most-requested adversarial inputs as scenarios + any fixes
- [ ] Reach out to 3 enterprise design-partner candidates from launch-day inbound
- [ ] Decide: SOC 2 timeline. Talk to 2 audit firms.

---

## Hashtag library (use selectively, never all at once)

**Tier 1 (always):** `#MCP` `#AISafety` `#PromptInjection`

**Tier 2 (high relevance):** `#LLMSecurity` `#AgentSecurity` `#AIFirewall` `#AIGuardrails` `#OpenSource` `#OpenSourceSecurity` `#BuildInPublic`

**Tier 3 (community-specific):** `#ClaudeAI` `#OpenAI` `#Cursor` `#VSCode` `#LangChain` `#DevSecOps` `#AppSec` `#CISO` `#Cybersecurity` `#ZeroTrust` `#ZeroTrustAI` `#DLP`

**Tier 4 (compliance buyers):** `#SOC2` `#HIPAA` `#GDPR` `#CCPA` `#DPDP` `#FERPA` `#PCIDSS` `#Compliance`

**Tier 5 (regional / event):** `#YC` `#YCS26` `#OnDeck` `#a16z` `#SequoiaCap` `#AWSreInvent` `#KubeCon` — only when contextually true.

## Repo GitHub Topics (set in repo settings → About)

Recommended 20 topics (max GitHub allows):

```
mcp, model-context-protocol, ai-safety, ai-security, prompt-injection,
llm-security, agent-security, ai-firewall, ai-guardrails, dlp,
pii-detection, security, guardrails, claude-desktop, openai-agents,
cursor, vscode, typescript, nextjs, fastify
```

## Repo "About" description (350 char limit)

```
🛡️ Universal security gateway for AI agents — MCP-native. Sits between any Claude / OpenAI / Cursor / VS Code agent and the real tools, blocking destructive actions, redacting 28 PII types, detecting injection across 13 non-English languages plus English, tracking taint, requiring approval. < 1 ms per decision. MIT. github.com/inbharatai/jak-shield
```
