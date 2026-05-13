# Manual Launch — 30-second copy-paste blocks

The sandbox is configured to block any agent action that publishes under your
identity on external systems (GitHub Discussions, awesome-mcp-servers fork +
PR, npm signup, Smithery signup). That's the right policy and I won't try to
work around it. Instead, every step below is reduced to copy-paste so you can
do them yourself in roughly the time it'd take me to drive a browser.

Order matters: do them top to bottom. Each block tells you the URL, the click
path, and the exact text to paste.

---

## 1. Welcome Discussion (3 min)

**Open:** https://github.com/inbharatai/jak-shield/discussions/new?category=general

**Title:**

```
Welcome — what JAK Shield is, what it isn't, and how to help
```

**Body:** paste the entire contents of `.github/launch/DISCUSSION_WELCOME.md`
(already committed in your working tree on this branch). The file is
calibrated to be honest — no "better than X" claims, explicit disclaimers, no
unverified head-to-head benchmark wording.

Click **Start discussion**.

Pin it: open the discussion → click the `…` menu → **Pin discussion**.

---

## 2. awesome-mcp-servers PR (8 min)

The README in that repo updates frequently, so the section name you target
may have shifted. Always grep first.

```bash
# 2.1 Fork to your account
gh repo fork punkpeye/awesome-mcp-servers --clone --remote

# 2.2 cd in (gh names the folder awesome-mcp-servers)
cd awesome-mcp-servers
git checkout -b add-jak-shield

# 2.3 Find where to add the entry — search for an existing Security section
grep -n -i "security" README.md | head -20
# Look for headings like "## 🔒 Security" or "### Security".
# If none exists, fall back to "Server frameworks" or "Other tools".

# 2.4 Open README.md in your editor and add this line in alphabetical order:
```

```markdown
- [JAK Shield](https://github.com/inbharatai/jak-shield) 🛡️ — Universal security gateway for AI agents. Sits between any MCP client (Claude Desktop, Cursor, VS Code, Cline, Windsurf, Zed, Continue, OpenAI Agents SDK) and the real tools the agent calls. Blocks destructive actions, redacts 28 PII types with cryptographic checksum validators (Luhn / Verhoeff / mod-97 IBAN / ABA / mod-11 NHS / CPF / CNPJ / SIN / NRIC / TFN / EIN / SWIFT / Bitcoin / Ethereum), detects prompt injection across 6 stages and 13 non-English languages plus English baseline, tracks taint across calls with MinHash + n-gram fingerprinting, requires human approval, HMAC-signed decisions with key rotation, scoped capability tokens, regulatory hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA). 45-scenario adversarial benchmark in CI. MIT, TypeScript.
```

```bash
# 2.5 Commit + push + open PR
git add README.md
git commit -m "Add JAK Shield — MCP-native security gateway"
git push -u origin add-jak-shield
```

**PR title:**

```
Add JAK Shield — MCP-native security gateway
```

**PR body** — paste this whole block:

```markdown
JAK Shield is an open-source security gateway that sits between any
MCP-compatible AI client (Claude Desktop, Cursor, VS Code, Cline, Windsurf,
Zed, OpenAI Agents SDK) and the real tools the agent calls.

Adds defense-in-depth to the MCP tool-call boundary:

- 8 deterministic policy rules + RBAC + approval queue
- PII detection across 28 types with Luhn / Verhoeff / mod-97 / ABA / mod-11 checksum validators
- Prompt-injection detection in 6 stages across 13 non-English languages + English baseline
- Cross-call taint tracking with MinHash + n-gram fingerprinting
- 20 attack-chain patterns with data-flow tracking + time-decay weighting
- EWMA + z-score behavioral anomaly detection, multi-window, per-tenant + per-agent
- Short-lived, single-use, scope-bound capability tokens (HMAC-signed JWT)
- HMAC-SHA256 signed decisions with key rotation
- Regulatory hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA) with citations + disclaimer (not legal advice)
- 45-scenario adversarial benchmark in CI passing 45/45
- p95 evaluation latency 0.64 ms on a developer laptop

Repo: https://github.com/inbharatai/jak-shield
License: MIT
Works with: Claude Desktop, Claude Code, Anthropic API, OpenAI Agents SDK, OpenAI Responses API, Cursor, VS Code, Cline, Windsurf, Zed, Goose, Continue, Mastra, n8n, LibreChat, LangChain (Python + JS), LlamaIndex, CrewAI, Vercel AI SDK, Pydantic AI, plus an OpenAPI 3.1 spec for ChatGPT Custom GPTs and Gemini function declarations.
```

Then:

```bash
gh pr create --title "Add JAK Shield — MCP-native security gateway" --body-file <(cat <<'EOF'
(paste the body above between EOF markers)
EOF
)
```

Or just paste it into the GitHub web UI after `git push` — the link gh prints
takes you straight to the PR creation page.

---

## 3. Smithery.ai submission (4 min)

`smithery.yaml` is already committed at the repo root and is valid.

1. Go to https://smithery.ai → **Sign in** → **Continue with GitHub**
   (uses your existing GitHub OAuth, no new password)
2. Click **Submit Server** (or the equivalent on their current UI)
3. Point at the GitHub repo: `inbharatai/jak-shield`
4. Smithery auto-reads `smithery.yaml` from the root
5. Click **Submit for review**

If Smithery asks for a server icon, the path it'll auto-pick is:
`https://raw.githubusercontent.com/inbharatai/jak-shield/main/.github/assets/jak-shield-banner.svg`

Approval typically takes 24–72h.

---

## 4. npm publish (20 min including 2FA setup)

**Important security note:** the password `Reetu@12345` you mentioned is too
weak for npm. npm accounts can ship malware to thousands of installs. Use a
password manager and generate a 24-char random password. Also enable 2FA
**before** publishing the first package — npm allows requiring 2FA for
publishes which protects you if your token leaks.

### 4.1 Account + 2FA

1. https://www.npmjs.com/signup
   - Email: `reetu004@gmail.com`
   - Username: `inbharatai` (matches GitHub, helps with discoverability)
   - Password: generate fresh in your password manager, ≥ 20 chars
2. Verify email
3. Settings → **Two-factor authentication** → enable on **Authorization and publishing**
4. Save the TOTP backup codes somewhere safe

### 4.2 Claim the org

1. https://www.npmjs.com/org/create
   - Org name: `jak-shield`
   - Plan: **Free** (public packages only)
2. Confirm

### 4.3 Login from CLI

```bash
npm login
# email: reetu004@gmail.com
# username: inbharatai
# password: (the one you generated)
# OTP: (from your authenticator app)
```

Verify: `npm whoami` should print `inbharatai`.

### 4.4 Dry-run the publish

```bash
cd "C:/Users/reetu/Desktop/jak shield"
node scripts/prepare-npm-publish.mjs
node scripts/publish-all.mjs --dry-run
```

Check the printed plan: 32 packages in topo order, no surprises.

### 4.5 Real publish

```bash
node scripts/publish-all.mjs
# It'll prompt for OTP — same TOTP app
```

If anything fails midway, the script is idempotent: rerun and it skips
already-published versions.

### 4.6 Verify

```bash
npm view @jak-shield/mcp-server version
# Should print 0.1.0
```

And on the web: https://www.npmjs.com/package/@jak-shield/mcp-server

---

## 5. Post-publish polish (10 min)

Once npm is live, the README's `npx @jak-shield/mcp-server` install path
actually works. At that point:

- Update the GitHub repo's About section: add `https://www.npmjs.com/org/jak-shield` as a homepage
- Add Twitter/X share button by editing the `socialPreview` image in Settings → General
- Open https://github.com/inbharatai/jak-shield/releases/tag/v0.1.0 → edit → mention "npm: `npx @jak-shield/mcp-server`" in the body

---

## What I'm doing in parallel while you handle the public-facing steps

While you do the above, I'm going to:

1. Verify the build/tests/bench still pass cleanly after the recent adapter additions
2. Tighten the docs for any rough edges
3. Add a `CHANGELOG.md` so v0.1.1 has a starting point
4. Prepare a `RELEASE_v0.1.1_CHECKLIST.md` for the next patch

That work doesn't require external-system writes, so I can keep moving.
