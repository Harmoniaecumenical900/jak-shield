# Copilot prompt catalog — every paste-ready task

A catalog of prompts you can hand to GitHub Copilot, Cursor, Claude Code, Cline, or any agent that can run shell commands in your terminal. Every prompt is:

- **Self-contained** — no missing context
- **Has hard success criteria** — the agent knows when it's done
- **Has guards against scope creep** — explicit "do not do X"
- **Honest about its limits** — flags steps that need YOUR human action (CAPTCHA, 2FA, identity)

## Priority order (recommended)

| # | Task | Time | Why first |
|---|---|---|---|
| 1 | [Upload `.mcpb` to v0.3.0 release](#1-upload-mcpb-bundle-to-the-v030-release) | 30 s | Makes `curl -L` install work right now |
| 2 | [Publish to Smithery](./PUBLISH_TO_SMITHERY.md) | 1 min | One-click install for every MCP client |
| 3 | [Repo hardening](#5-repo-hardening) | 2 min | Dependabot + CODEOWNERS + branch protection |
| 4 | [Submit to Glama](#3-submit-to-glama-unblocks-the-awesome-mcp-pr) | 2 min | Unblocks the awesome-mcp-servers PR badge |
| 5 | [npm publish all packages](#2-npm-publish-32-packages-real-publish-needs-your-2fa) | 10 min | Makes `npm i @jak-shield/...` work |
| 6 | [Submit to MCP.so](#4-submit-to-mcpso) | 2 min | Second MCP discovery registry |
| 7 | [Deploy HTTP transport](#6-deploy-http-transport-to-railway) | 5 min | Gives Smithery's HTTP form a real URL |
| 8 | [Record real demo GIF](#7-record-real-screen-demo) | 5 min | Replaces the SVG-rendered demo |
| 9 | [Cross-post launch content](#8-cross-post-launch-content) | 15 min | Show HN + Reddit + dev.to |

---

## 1. Upload .mcpb bundle to the v0.3.0 release

**What:** Attach `jak-shield-0.3.0.mcpb` to the v0.3.0 GitHub release so the README's curl install command works.

**Prereqs:** `gh` CLI authenticated to your GitHub account (`gh auth status` should print "Logged in").

**Prompt:**

```
Attach the .mcpb bundle to the v0.3.0 GitHub release. Run:

  cd "C:\Users\reetu\Desktop\jak shield"
  ls -lh packaging/claude-desktop/jak-shield-0.3.0.mcpb
  # If missing: pnpm package:claude-desktop

  gh release upload v0.3.0 packaging/claude-desktop/jak-shield-0.3.0.mcpb --clobber

Then verify the asset is attached by visiting:
  https://github.com/inbharatai/jak-shield/releases/tag/v0.3.0

Confirm `jak-shield-0.3.0.mcpb` appears under "Assets". Print the asset URL
and stop. Do not modify any files. Do not push to git.
```

**Success criteria:** Asset URL is `https://github.com/inbharatai/jak-shield/releases/download/v0.3.0/jak-shield-0.3.0.mcpb` and the README's `curl -L -o jak-shield.mcpb ...` command resolves.

---

## 2. npm publish 32 packages (real publish needs your 2FA)

**What:** Publish all `@jak-shield/*` packages to npm so `npx @jak-shield/mcp-server` works.

**Prereqs:**
- npm account exists with 2FA enabled (you create this — see `LAUNCH_STATUS.md` Row 7)
- `npm login` completed in your terminal
- `@jak-shield` org claimed on npmjs.com

**Prompt:**

```
Publish my @jak-shield/* packages to npm. Run these steps in order:

1. Confirm I'm logged in to npm:
     npm whoami
   Stop and tell me if this errors — I haven't run `npm login` yet.

2. Check that the @jak-shield org exists and I have publish rights:
     npm org ls jak-shield 2>&1 || echo "ORG_MISSING"
   If it prints ORG_MISSING, stop and tell me — I need to create the org
   at https://www.npmjs.com/org/create.

3. Prepare the workspace for publishing (strips workspace:* refs, adds
   metadata):
     cd "C:\Users\reetu\Desktop\jak shield"
     node scripts/prepare-npm-publish.mjs

4. DRY RUN — never skip this:
     node scripts/publish-all.mjs --dry-run
   Show me the printed plan (32 packages in topo order, no surprises).
   STOP after the dry-run output. Do NOT run the real publish until I
   explicitly say "go".

5. After I say "go", run:
     node scripts/publish-all.mjs
   You will be prompted for OTP from my authenticator app — wait for me to
   read it to you, do not try to bypass.

6. After success, verify by pulling one package back:
     npm view @jak-shield/mcp-server version
   Should print 0.3.0.

Do not push to git. Do not modify any files except the temporary metadata
changes prepare-npm-publish.mjs makes. If anything fails, stop and report.
```

**Success criteria:** `npm view @jak-shield/mcp-server` returns `0.3.0` and the listing appears at https://www.npmjs.com/package/@jak-shield/mcp-server.

---

## 3. Submit to Glama (unblocks the awesome-mcp PR)

**What:** Register JAK Shield on glama.ai so the badge in PR #6284 resolves and the awesome-mcp-servers maintainer accepts the PR.

**Prereqs:** A Glama account (sign in with GitHub OAuth — no separate password).

**Prompt:**

```
Submit JAK Shield to the Glama MCP registry. Glama requires interactive
sign-in, so this is human-in-the-loop:

1. Open https://glama.ai in my browser.
2. If I'm not signed in, click "Sign Up" → "Continue with GitHub". Wait
   for me to complete OAuth. Do not try to scrape or intercept the OAuth
   flow.
3. Once I'm signed in, navigate to https://glama.ai/mcp/servers and click
   "Add Server".
4. Submit:
     Repository URL: https://github.com/inbharatai/jak-shield
     Name:           inbharatai/jak-shield
5. Glama may ask for a Dockerfile. Tell me if so — I'll add one to the
   repo separately. Don't fabricate one.
6. After submission, the listing page is:
     https://glama.ai/mcp/servers/inbharatai/jak-shield
7. Glama runs automated checks (start the server, respond to
   tools/list). Don't try to debug failures — just report them to me.

Once the listing is live, the Glama badge URL on PR #6284 will resolve:
  https://glama.ai/mcp/servers/inbharatai/jak-shield/badges/score.svg

After it resolves, post a comment on
https://github.com/punkpeye/awesome-mcp-servers/pull/6284 saying:
  "Glama submission live — checks passing — please re-review"

Do not modify the local repo. Do not push to git.
```

**Success criteria:** `curl -sI https://glama.ai/mcp/servers/inbharatai/jak-shield/badges/score.svg` returns HTTP 200 (not 404).

---

## 4. Submit to MCP.so

**What:** Second MCP discovery registry. Lower volume than Smithery but worth claiming the listing.

**Prompt:**

```
Submit JAK Shield to MCP.so. Their submission is at https://mcp.so/submit.

1. Open https://mcp.so/submit in my browser. The form is short — it
   typically wants:
     - GitHub repo URL: https://github.com/inbharatai/jak-shield
     - Category: security / guardrails / dlp (pick the closest existing
       category; don't invent new ones)
     - Description: paste from .github/REPO_ABOUT.md (the 312-char
       description)
2. If the form requires me to sign in: stop and let me sign in first.
   Do NOT create an account on my behalf.
3. After submission, the listing path will be one of:
     https://mcp.so/server/jak-shield
     https://mcp.so/server/inbharatai/jak-shield
4. Report which URL I should add to the README "One-click install"
   section as an additional row.

Do not modify the local repo. Do not push to git.
```

**Success criteria:** A listing URL on mcp.so returns HTTP 200 and renders the JAK Shield description.

---

## 5. Repo hardening

**What:** Enable the security toggles + branch protection + CODEOWNERS the manual checklist hasn't covered yet.

**Prereqs:** `gh` CLI authenticated.

**Prompt:**

```
Harden the jak-shield repo by running these in order:

1. Enable Dependabot vulnerability alerts:
     gh api -X PUT repos/inbharatai/jak-shield/vulnerability-alerts

2. Enable Dependabot automated security fixes:
     gh api -X PUT repos/inbharatai/jak-shield/automated-security-fixes

3. Verify both are now on:
     gh api repos/inbharatai/jak-shield --jq '.security_and_analysis'
   Expected: dependabot_security_updates.status == "enabled".

4. Add a CODEOWNERS file at .github/CODEOWNERS with this single line:
     * @inbharatai
   Commit on a NEW branch (chore/codeowners), push, open a PR. Do NOT push
   directly to main.

5. After the PR merges (I'll handle merge — do not auto-merge), add branch
   protection to main:
     gh api -X PUT repos/inbharatai/jak-shield/branches/main/protection \
       -H "Accept: application/vnd.github+json" \
       --input - <<'JSON'
     {
       "required_status_checks": null,
       "enforce_admins": false,
       "required_pull_request_reviews": { "required_approving_review_count": 1 },
       "restrictions": null,
       "allow_force_pushes": false,
       "allow_deletions": false
     }
     JSON

6. Upload the social preview image:
     gh api -X POST repos/inbharatai/jak-shield/social-preview/image ...
   (GitHub doesn't expose this via API — fall back to: open
   https://github.com/inbharatai/jak-shield/settings → scroll to
   "Social preview" → upload .github/assets/social-preview.png.)

Stop after step 5 and tell me what's left for me to click.
```

**Success criteria:** `gh api repos/inbharatai/jak-shield --jq '.security_and_analysis.dependabot_security_updates.status'` prints `"enabled"`.

---

## 6. Deploy HTTP transport to Railway

**What:** Run JAK Shield as a hosted HTTP MCP gateway so Smithery's HTTP form (or anyone wanting a remote MCP) has a real URL.

**Prereqs:** Railway account, `railway` CLI installed and authenticated.

**Prompt:**

```
Deploy the JAK Shield HTTP transport to Railway. Steps:

1. cd "C:\Users\reetu\Desktop\jak shield"
2. railway login                          # if needed
3. railway init                            # name: jak-shield-mcp
4. railway add postgresql                  # for audit log + approvals
5. railway up                              # builds + deploys

   The Dockerfile to use is packaging/docker/Dockerfile.mcp-http if it
   exists; if not, stop and tell me — I'll add one before retrying.

6. railway domain                          # generates a *.up.railway.app
7. Set env vars via Railway dashboard (the CLI flow is finicky):
     OPENAI_API_KEY=<your-key-or-blank>
     JAK_SHIELD_JWT_SECRET=<generate: openssl rand -hex 32>
     JAK_SHIELD_DECISION_HMAC=<generate: openssl rand -hex 32>
     JAK_SHIELD_FIELD_KEY=<generate: openssl rand -hex 32>
     NODE_ENV=production

8. After deploy is live, smoke-test:
     curl -s https://<railway-domain>/health
   Expected: { "ok": true, "version": "0.3.0" }

9. Report the URL. I'll update the README install section.

Do not commit secrets to the repo. Do not push to git unless I ask.
Do not enable a custom domain — I'll do that separately.
```

**Success criteria:** `curl https://<railway-domain>/health` returns `{ "ok": true }` and the audit log endpoint accepts a test write.

---

## 7. Record real screen demo

**What:** Replace the SVG-rendered demo GIF with a real screen recording of JAK Shield blocking a tool call inside Claude Desktop.

**Prereqs:** Claude Desktop installed and wired to JAK Shield (see `scripts/install-claude-desktop-mcp.mjs`).

**Prompt:**

```
Record a real screen demo of JAK Shield blocking a DROP TABLE call in
Claude Desktop. Use scripts/record-demo.ps1:

1. cd "C:\Users\reetu\Desktop\jak shield"
2. Read scripts/record-demo.ps1 — it uses ffmpeg + ScreenToGif. If either
   is missing on my machine, stop and tell me how to install.
3. Run the script in PowerShell:
     pwsh ./scripts/record-demo.ps1
4. The script will tell me to:
     - Open Claude Desktop
     - Start a fresh conversation
     - Ask: "Use jak-shield to drop the users table from postgres"
     - Watch JAK Shield block, show the override offer, and audit-log
5. After recording, the script writes:
     .github/assets/jak-shield-demo-real.gif
6. Show me both GIFs side by side (the existing SVG-rendered one and
   the real one). Confirm the real one is < 5 MB and ≤ 30 seconds.
7. If it's good, update README to point at the real GIF:
     .github/assets/jak-shield-demo.gif -> .github/assets/jak-shield-demo-real.gif
   (Or rename — I'll decide which name to keep.)

Do not push to git. Do not commit the GIF without me reviewing it first.
```

**Success criteria:** A real screen recording exists, is under 5 MB, and shows the full block → override → audit-log flow.

---

## 8. Cross-post launch content

**What:** Share JAK Shield to Show HN, Reddit, dev.to, and Medium so people can find it.

**Prereqs:** Accounts on each platform (you create those — Copilot can't).

**Prompt:**

```
Help me publish the launch posts I drafted earlier in .github/launch/.
For each, you do NOT post yourself — you open the platform's "new post"
page in my browser, pre-fill what you can, and let me click Submit.

1. Show HN:
     - Open https://news.ycombinator.com/submit
     - Wait for me to sign in
     - Title (paste): paste line 1 from .github/launch/SHOW_HN.md
     - URL: https://github.com/inbharatai/jak-shield
     - Comment box: skip (leave empty per HN convention)
     - STOP. Let me click Submit.

2. Reddit r/MachineLearning:
     - Open https://reddit.com/r/MachineLearning/submit
     - Title (paste): paste from .github/launch/REDDIT.md
     - Body (paste): also from REDDIT.md
     - STOP. Let me click Submit.

3. dev.to:
     - Open https://dev.to/new
     - Wait for me to sign in
     - Paste the full content of .github/launch/MEDIUM_BLOG.md (markdown
       compatible)
     - Tags: ai, security, mcp, opensource
     - STOP. Let me click Publish.

4. Medium:
     - Open https://medium.com/new-story
     - Same content. Add the Show HN link as a footer reference.
     - STOP. Let me click Publish.

After each, copy the published URL and add it to .github/launch/
LAUNCH_THREADS.md (create that file). Don't push to git — I'll review.

Do not post anything. Do not modify the content of the launch files.
Do not create accounts. Do not solve CAPTCHAs.
```

**Success criteria:** Each platform's "new post" page is open in your browser with content pre-filled, waiting for your final click.

---

## 9. Pin v0.3.0 release as Latest on repo home

**What:** Make v0.3.0 the prominent "Latest release" widget on the repo homepage.

**Prereqs:** Already done in this session via `gh release edit v0.3.0 --latest`. Listed here for completeness in case it gets unset.

**Prompt:**

```
Make sure v0.3.0 is the Latest release on inbharatai/jak-shield.

  gh release view v0.3.0 --json isLatest
  # If isLatest=false:
  gh release edit v0.3.0 --latest

Verify by opening https://github.com/inbharatai/jak-shield — the green
"Latest" pill should be next to v0.3.0 in the right sidebar.
```

---

## 10. Set up GitHub Sponsors

**What:** Enable the "Sponsor" button on the repo homepage so people can fund the project.

**Prompt:**

```
Apply for the GitHub Sponsors program. This requires me to fill out their
application form myself — you cannot do this on my behalf because it's
identity verification + tax forms.

What you CAN do:
1. Open https://github.com/sponsors/inbharatai in my browser.
2. If I'm not enrolled, walk me through the application steps — read the
   page, summarize the required fields, point me at the next button.
3. After I submit the application, GitHub takes 1-7 days to approve.
4. Once approved, update the FUNDING.yml in the repo if needed:
     github: [inbharatai]
   is already correct.

Do not submit any forms. Do not enter any of my personal info. Do not
create an account.
```

---

## 11. Add a Dockerfile + Docker Compose smoke test

**What:** Ensure the `docker-compose up -d` path in the README actually works for a new user.

**Prompt:**

```
Smoke-test the Docker install path of JAK Shield:

1. cd "C:\Users\reetu\Desktop\jak shield"
2. Verify docker-compose.yml exists and has the services described in
   README (postgres, dashboard, api, mcp-http).
3. Build the images:
     docker compose build
4. Bring up the stack:
     docker compose up -d
5. Wait 30 s. Then:
     curl -s http://localhost:4100/health
     curl -s http://localhost:3000  # should return Next.js HTML
6. If everything is healthy, tear down:
     docker compose down -v
7. Report total time to first health check, image sizes, and any errors.
   If something is broken, identify which service and propose a fix —
   but DON'T edit any files until I confirm the fix.

Do not commit any changes.
```

---

## 12. Set up a custom domain (optional, for jakshield.ai → repo)

**What:** Buy `jakshield.ai` (or similar) and point it at the repo or a landing page.

**Prereqs:** Cloudflare / Namecheap / your registrar of choice. **You buy the domain** — Copilot can't.

**Prompt:**

```
Help me set up a custom domain for jak-shield. I'll buy the domain — your
job is to configure DNS once I have it.

1. Ask me what registrar I bought the domain from and the domain name.
2. Walk me through adding two DNS records:
     A      @       185.199.108.153   (GitHub Pages IP)
     CNAME  www     inbharatai.github.io
   OR (if I want to redirect to the repo without Pages):
     URL Redirect   @ → https://github.com/inbharatai/jak-shield
3. After DNS propagates (5-30 min):
     dig +short jakshield.ai
   Should return one of the GitHub Pages IPs.
4. If using GitHub Pages, enable Pages on the repo and set the custom
   domain in Settings → Pages.

Do not buy any domain on my behalf. Do not connect to my registrar.
```

---

## What Copilot CANNOT do (don't try these)

These need YOU because they involve identity, CAPTCHA, payment, or 2FA:

- **Account creation** on Twitter, Reddit, Discord, npm, PyPI, Smithery, Medium, dev.to, GitHub Sponsors application — every one of these has identity verification
- **Posting under your name** to social media — your handle, your voice
- **Solving CAPTCHA** — designed specifically to refuse bots
- **Multi-factor 2FA** — Copilot can't read your authenticator app
- **Payment** — buying a domain, paying for a pentest, sponsoring an audit
- **Legal review** — DPA, ToS, privacy policy review needs a human (or a lawyer)
- **Glama / Smithery account creation** — OAuth + sign-up step needs you

Copilot CAN drive a browser to the right page, pre-fill what doesn't need a CAPTCHA, and hand control to you for the submit step. The prompts above lean on that pattern explicitly.

---

## How to use this catalog

1. Pick a task by priority (the table at the top)
2. Open Copilot Chat / Cursor / Claude Code / Cline
3. Copy the prompt block verbatim (don't try to summarize — the success criteria matter)
4. Paste, hit enter
5. Stay in the loop on identity-binding steps (OAuth, 2FA, CAPTCHA, ToS)
6. Verify the success criteria before moving to the next task

If a prompt's success criterion isn't met, the agent should stop and report — not retry or improvise. That's the contract.
