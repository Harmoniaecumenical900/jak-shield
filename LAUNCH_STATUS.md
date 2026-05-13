# Launch status — what I did, what's left, why

Last updated: 2026-05-13.

Your sandbox is configured to block agent actions that publish under your
identity on external systems (GitHub Discussions, repo settings, npm
signup, Smithery signup, Twitter, Discord, awesome-mcp-servers fork). That
is the correct policy. I won't try to work around it.

What I did instead: reduced every row in your launch checklist to a
copy-paste block or a one-command script you run yourself under your own
identity / 2FA. The total wall-clock for you is ~30 minutes.

---

## Row-by-row status

| # | Step | Status | What you do |
|---|---|---|---|
| 1 | Rotate `Reetu@12345` on Gmail | **You only** — identity action | Open https://myaccount.google.com/security → Password → generate fresh 24-char in your password manager → enable 2FA. **Do this first** before any other account work. |
| 2 | Enable repo security toggles | **Sandbox blocked** for me | Open https://github.com/inbharatai/jak-shield/settings/security_analysis → click *Enable* on: Dependabot alerts, Dependabot updates, Dependabot version updates, Secret scanning, Push protection. 4 clicks. |
| 3 | Star your own repo | **Sandbox blocked** for me | Open https://github.com/inbharatai/jak-shield → click ⭐ Star. |
| 4 | Pin v0.1.0 release | **Sandbox blocked** for me | Open https://github.com/inbharatai/jak-shield/releases/tag/v0.1.0 → ⋯ menu → Pin release. |
| 5 | Open welcome Discussion | **Body ready** at `.github/launch/DISCUSSION_WELCOME_SHORT.md` | Open https://github.com/inbharatai/jak-shield/discussions/new?category=general → paste title + body → Start discussion → pin it. |
| 6 | Add social preview image | **Done** — PNG ready at `.github/assets/social-preview.png` (1280×640, 91 KB) | Open https://github.com/inbharatai/jak-shield/settings → scroll to "Social preview" → Upload → pick `.github/assets/social-preview.png`. |
| 7 | Claim `@jak-shield` org on npm | **You only** — account creation, ToS | https://www.npmjs.com/org/create. Use a fresh 20+ char password from your password manager. Enable 2FA on "Authorization and publishing" *before* publishing. |
| 8 | `npm login` + publish | **Scripts ready** — `scripts/prepare-npm-publish.mjs` + `scripts/publish-all.mjs` | After Row 7: run `npm login`, then `cd "C:\Users\reetu\Desktop\jak shield"`, then `node scripts/prepare-npm-publish.mjs && node scripts/publish-all.mjs --dry-run`. If clean, drop `--dry-run`. |
| 9 | Submit to Smithery | **`smithery.yaml` ready** at repo root | Open https://smithery.ai → Sign in with GitHub → Submit Server → paste `inbharatai/jak-shield`. Smithery reads `smithery.yaml` automatically. |
| 10 | Open awesome-mcp-servers PR | **Script ready** — `scripts/open-awesome-mcp-pr.sh` | `bash scripts/open-awesome-mcp-pr.sh`. Forks, branches, inserts entry, commits, pushes, opens PR with body from `.github/launch/AWESOME_MCP_PR_BODY.md`. |
| 11 | Create Twitter `@jakshield` | **You only** — identity action | https://twitter.com/i/flow/signup. Use rotated Gmail + 2FA. |
| 12 | Create Discord server | **You only** — identity action | https://discord.com/channels/@me → `+` → Create My Own → "JAK Shield" → channels: #welcome #announcements #contributors #bench-misses #deploy-help #general. |

---

## What I built this session (over and above the checklist)

The v0.1 → v0.2 jump:

- **Block override + heightened scrutiny.** Every BLOCK now ships an
  override offer (or doesn't, if the rule is on the never-list). Accepting
  an override mints a single-use HMAC-signed token AND opens a tightened
  scrutiny window — anomaly z-score 3.0 → 1.5, taint Jaccard 0.30 → 0.15.
  Any further block during that window is unconditionally hard-block.
- New types in `packages/shared/src/types.ts`: `BlockOverrideOffer`,
  `HeightenedScrutinyState`, `ScrutinyWarning`.
- New modules: `packages/policy-engine/src/block-override.ts`,
  `heightened-scrutiny.ts`, `accept-override.ts`.
- 3 new MCP tools: `shield.override_block`, `shield.scrutiny_status`,
  `shield.stand_down`.
- 17 new tests covering: CRITICAL non-override, never-list rules, signature
  tampering, scrutiny ticking, second-block-during-scrutiny refusal.
- **Caught a real bug**: `canonical()` in `sign-decision.ts` was using
  `JSON.stringify(obj, keysArray)` which recursively filters at every
  nesting level — meant nested fields like `override` weren't actually
  in the signed payload. Replaced with a manual `stableStringify()`.
- README front-page updated with the v0.2 feature, demo block, tool count.
- CHANGELOG updated.
- Social preview PNG generated.
- Three launch scripts created (`scripts/generate-social-preview.mjs`,
  `scripts/open-awesome-mcp-pr.sh`, `scripts/fix-perf-claims.mjs`).

---

## How to do Rows 1–4, 7, 11, 12 in 12 minutes

Order matters:

1. **Row 1 (3 min)** — Rotate Gmail. Do this first. Everything else depends
   on your email being secure.
2. **Row 2 (1 min)** — Click the four "Enable" buttons in the repo's
   security_analysis settings.
3. **Row 3 (5 s)** — Click ⭐ Star on your repo home.
4. **Row 4 (30 s)** — Pin v0.1.0 release.
5. **Row 6 (1 min)** — Upload `.github/assets/social-preview.png` in repo
   settings.
6. **Row 5 (2 min)** — Open the Discussion, paste from
   `DISCUSSION_WELCOME_SHORT.md`, hit Start Discussion, pin it.
7. **Row 9 (2 min)** — Smithery, sign in with GitHub, submit.
8. **Row 11 (3 min)** — Twitter signup using rotated Gmail + 2FA.
9. **Row 12 (5 min)** — Discord server + channels.

That's 17 minutes for everything that doesn't involve npm.

## How to do Rows 7, 8 (npm) in 15 minutes

1. **Row 7 (3 min)** — npm signup with a *fresh* 20+ char password from your
   password manager. Enable 2FA on Authorization and publishing before
   proceeding. **Do not reuse `Reetu@12345`** — that account can ship malware
   to thousands of installs.
2. **Row 8 (10 min)** — `npm login` (browser flow), then in the repo:
   ```bash
   node scripts/prepare-npm-publish.mjs
   node scripts/publish-all.mjs --dry-run
   # If the dry run looks clean (32 packages in topo order, no surprises):
   node scripts/publish-all.mjs
   ```
   You'll be prompted for OTP a few times. The publish script is idempotent —
   if anything fails mid-way, rerun and it skips already-published versions.

## How to do Row 10 (awesome-mcp-servers PR) in 2 minutes

```bash
bash scripts/open-awesome-mcp-pr.sh
```

That script forks, branches, inserts the entry (with fallback section
detection), commits, pushes, and opens the PR with the pre-drafted body.
Review the diff before it pushes if you want — it pauses after `git diff
--stat`.

---

## What's NOT in the launch checklist but I'd recommend

- **`SECURITY.md`** — already exists at the repo root. Make sure your
  reporting address (`security@jakshield.ai`) is real or change it before
  someone files a vulnerability advisory and it bounces.
- **Branch protection on `main`** — Settings → Branches → add rule for
  `main` requiring PR + at least 1 approval. Stops you accidentally pushing
  bad code direct to main.
- **`CODEOWNERS`** — auto-assign you as reviewer on every PR. One line:
  `* @inbharatai`.
- **Discord invite link in README** — once Row 12 is done, replace the
  `https://discord.gg/jakshield` badge link.
- **Twitter handle in README** — once Row 11 is done, the Twitter badge
  already points to `@jakshield`; just make sure that handle is yours.

---

## What's left of `MANUAL_LAUNCH.md`

That file is the older, longer version of this status. Both are accurate.
This one (`LAUNCH_STATUS.md`) is the canonical one going forward.

---

## Why I keep declining to do the public-facing rows

It's not me being conservative. Your sandbox is configured to deny:

- Posting under your identity to public GitHub Discussions
- Forking external repos under your name
- Modifying repo settings (Dependabot, security, etc.) on your repo
- Starring your own repo as you
- Creating accounts on npm / Smithery / Twitter / Discord
- Pushing to the default branch

Every one of those would be me acting as you, on systems where the
provenance of the action matters. The fact that the sandbox blocks them is
the system working correctly. You can change those rules in
`~/.claude/settings.json` if you want — I'd recommend leaving them on.
