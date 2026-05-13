# Publish JAK Shield to Smithery — copy-paste prompt for any AI coding assistant

Smithery is the MCP server registry that exposes one-click install buttons for clients like Claude Desktop, Cursor, Cline, and Windsurf. Once JAK Shield is published, it appears at:

**https://smithery.ai/server/reetu004/jak-shield**

The Smithery CLI requires a one-time OAuth login under your identity, which is why this is a human-in-the-loop step. Use the prompt below in **GitHub Copilot Chat**, **Cursor**, **Claude Code**, **Cline**, or any agent that can run shell commands in your terminal.

---

## Prerequisites (one-time)

- Node.js ≥ 20 + npm available on PATH (`node -v` should print ≥ v20)
- A GitHub account (Smithery auth uses GitHub OAuth)
- The repo cloned at `C:\Users\reetu\Desktop\jak shield`
- The `.mcpb` bundle built at `packaging/claude-desktop/jak-shield-0.3.0.mcpb` (already shipped in the repo; rebuild with `pnpm package:claude-desktop` if you want a fresh one)

---

## The prompt (paste this verbatim)

```
Please publish my JAK Shield MCP server to Smithery. Run these commands in
order, in the user's terminal — do not assume any of them is already done:

1. Change directory:
     cd "C:\Users\reetu\Desktop\jak shield"

2. Authenticate with Smithery. This opens my browser for GitHub OAuth — once
   I complete it, the CLI will return to the terminal with a token. Do not
   try to bypass the browser step; do not try to read the OAuth response;
   just wait for the CLI to print a success message.
     npx -y @smithery/cli@latest auth login

3. Verify the auth worked:
     npx -y @smithery/cli@latest auth whoami
   Expected: prints my token / username. If it prints "No token found",
   stop and tell me — the login step did not complete.

4. Verify the .mcpb bundle exists (built earlier; ~25 KB):
     ls -lh packaging/claude-desktop/jak-shield-0.3.0.mcpb
   If the file is missing, rebuild it first:
     pnpm package:claude-desktop

5. Publish the bundle to my namespace on Smithery:
     npx -y @smithery/cli@latest mcp publish ^
       ./packaging/claude-desktop/jak-shield-0.3.0.mcpb ^
       -n reetu004/jak-shield

   (PowerShell users: replace ^ with backtick `. Bash users: replace ^
    with backslash \. Or just put it all on one line.)

6. After success, print the Smithery URL and the listing badge markdown:
     URL:   https://smithery.ai/server/reetu004/jak-shield
     Badge: [![Smithery](https://smithery.ai/badge/reetu004/jak-shield)](https://smithery.ai/server/reetu004/jak-shield)

7. If step 5 fails with an authentication error: rerun step 2. If it fails
   with "namespace not found" or "no permission to publish to that
   namespace": stop and tell me — the namespace on Smithery may not be
   "reetu004" for my account.

Do not modify any files in the repo unless step 4 requires a rebuild.
Do not push to git. Do not create a release. Just run the seven steps and
report the result.
```

---

## What the prompt is designed to do (and not do)

- ✅ **Runs in your terminal**, not the agent's sandbox — your existing browser session, your `npx` cache, your filesystem
- ✅ **Idempotent** — if you've already logged in, step 2 is a no-op; the `auth whoami` check in step 3 catches that
- ✅ **Explicit on the OAuth flow** — tells the agent not to try to intercept the browser handoff
- ✅ **Falls back to rebuild** if the bundle is missing
- ✅ **Diagnoses common errors** (auth missing, namespace mismatch) and tells the agent to stop and ask
- ❌ **No git, no commits, no file writes** — Smithery publish is read-only against your repo
- ❌ **No "I'll just retry until it works"** — the prompt requires human-confirmable success criteria

---

## Manual alternative (no AI agent needed)

If you'd rather just run it yourself, three commands:

```powershell
cd "C:\Users\reetu\Desktop\jak shield"
npx -y @smithery/cli@latest auth login
npx -y @smithery/cli@latest mcp publish .\packaging\claude-desktop\jak-shield-0.3.0.mcpb -n reetu004/jak-shield
```

Or in Git Bash / WSL / macOS:

```bash
cd "/c/Users/reetu/Desktop/jak shield"
npx -y @smithery/cli@latest auth login
npx -y @smithery/cli@latest mcp publish ./packaging/claude-desktop/jak-shield-0.3.0.mcpb -n reetu004/jak-shield
```

---

## After it lands

1. Open https://smithery.ai/server/reetu004/jak-shield — confirm the listing renders, the description from `smithery.yaml` is correct, the examples are visible.
2. Update the README install section if Smithery hands you a different canonical URL (the `reetu004/jak-shield` path is your namespace + repo).
3. Replace the placeholder Smithery badge in the README install section with the live one.
4. Tell people to install with the one-click button on the listing — that's the magic.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `auth login` hangs forever | Browser didn't open / OAuth blocked | Ctrl-C, run again, watch for the printed URL |
| `auth whoami` says "No token found" after login | Login didn't write the token file | Check `~/.smithery/config.json` exists; on Windows: `%USERPROFILE%\.smithery\config.json` |
| `mcp publish` says "permission denied on namespace" | Namespace is your Smithery handle, not GitHub | Check `npx -y @smithery/cli@latest namespace list` for your actual namespace |
| `mcp publish` says ".mcpb not found" | Working directory wrong, or bundle not built | `pnpm package:claude-desktop` from the repo root |
| `mcp publish` succeeds but the listing is empty | Smithery still processing | Wait ~30 s, refresh https://smithery.ai/server/reetu004/jak-shield |

---

## Smithery deep-link install URLs (after publish)

Once the listing is live, these URLs install JAK Shield into each client with one click:

- **Claude Desktop:** `smithery://install/reetu004/jak-shield?client=claude-desktop`
- **Cursor:** `smithery://install/reetu004/jak-shield?client=cursor`
- **Cline (VS Code):** `smithery://install/reetu004/jak-shield?client=cline`
- **Windsurf:** `smithery://install/reetu004/jak-shield?client=windsurf`

Share those in launch threads (Show HN, Reddit, X) for friction-free adoption.
