# Deploy JAK Shield's HTTP MCP gateway to Railway

A live HTTPS URL for the MCP HTTP transport — needed for:
- Smithery's **hosted MCP** submission flow (the form that wanted `https://your-server.com/mcp`)
- OpenAI Agents SDK / Responses API remote-MCP integration
- Anyone who wants to use JAK Shield from a client that can't run a stdio process

After this guide, you'll have:
- `https://<your-railway-domain>/health` returning `{ ok: true }`
- `https://<your-railway-domain>/mcp/<tenantId>` accepting MCP requests
- Auto-rebuild on every push to `main`

Total time: **~5 minutes once you're logged into Railway.**

---

## Before you start

1. **You must run `railway login` in your terminal first.** The Railway MCP plugin reads the local CLI's token. Without it, every MCP call returns `Not authenticated`.

   ```bash
   railway login
   # opens https://railway.com/cli-login in your browser
   ```

2. **Generate fresh production secrets** (do not reuse anything from this doc — every example value here is a placeholder):

   ```bash
   node -e "const c = require('crypto'); ['JAK_SHIELD_JWT_SECRET','JAK_SHIELD_DECISION_HMAC','JAK_SHIELD_FIELD_KEY','JAK_SHIELD_COOKIE_SECRET'].forEach(k => console.log(k+'='+c.randomBytes(32).toString('hex')));"
   ```

   Save the output in your password manager. You'll paste these into the Railway env var screen in a moment.

3. **Pick your namespace.** Free Railway accounts get one personal workspace; teams get a workspace per team. Decide where `jak-shield-mcp` lives — usually personal for v0.3, team workspace once you have one.

---

## The Copilot prompt (paste verbatim)

Use this in **GitHub Copilot Chat / Cursor / Claude Code / Cline**. The prompt assumes the agent has the Railway MCP plugin installed (it does in Claude Code if `railway` CLI is on PATH and you've run `railway login`).

```
Deploy JAK Shield's HTTP MCP gateway to Railway. Use the Railway MCP tools
(mcp__railway__*) — not the railway CLI directly — so we get structured
results back.

Repo root: C:\Users\reetu\Desktop\jak shield

Plan (execute in order, stop at the first failure):

1. Verify authentication:
     mcp__railway__whoami
   If this returns "Not authenticated", stop and tell me — I need to run
   `railway login` myself.

2. List my workspaces to confirm where to create the project:
     mcp__railway__list_workspaces
   Use the personal workspace unless I tell you otherwise.

3. Check if a project named "jak-shield" already exists:
     mcp__railway__list_projects
   If yes, use that project_id. If no, create one:
     mcp__railway__create_project name="jak-shield"
   Record the returned project_id and default environment_id.

4. Add a managed Postgres database:
     mcp__railway__deploy_template template="postgres"
   Wait for it to provision. Record the DATABASE_URL it exposes (it'll
   appear as a reference variable on the postgres service).

5. Create the MCP HTTP service from this GitHub repo:
     mcp__railway__create_service
       name="mcp-http"
       source_repo="inbharatai/jak-shield"
   The railway.json at the repo root tells Railway to build with
   Dockerfile.mcp.

6. Set environment variables on mcp-http. I will paste the secret values
   into the Railway dashboard MYSELF (do not generate or set secrets via
   the API — those would end up in the deployment trigger log).

   Set these via the dashboard:
     DATABASE_URL=<reference variable from step 4's postgres service>
     SHIELD_MCP_HTTP_PORT=4101
     SHIELD_HTTP_HOST=0.0.0.0
     OPENAI_API_KEY=<my key, or leave blank>
     OPENAI_MODEL=gpt-4o-mini
     JAK_SHIELD_JWT_SECRET=<from my password manager, generated locally>
     JAK_SHIELD_DECISION_HMAC=<from my password manager>
     JAK_SHIELD_FIELD_KEY=<from my password manager>
     JAK_SHIELD_COOKIE_SECRET=<from my password manager>
     NODE_ENV=production
     SHIELD_AUTH_OPTIONAL=0
     SHIELD_DEFAULT_TENANT_ID=public

   STOP here and tell me to open the Railway dashboard at the project URL,
   paste the secrets, and confirm when done. Do NOT proceed to step 7
   until I say "go".

7. Generate a Railway service domain:
     mcp__railway__generate_domain service_id="mcp-http" port=4101
   Record the URL.

8. Wait for the deploy to settle (60-120 s), then check logs:
     mcp__railway__get_logs service_id="mcp-http" log_type="deploy" lines=50
   Look for "JAK Shield MCP HTTP gateway listening on http://0.0.0.0:4101/mcp".

9. Smoke-test the deployment:
     curl -s https://<railway-domain>/health
   Expected: { "ok": true, "version": "0.3.0", ... }
   If it 502s, wait 30 s and retry — the container is still starting.

10. Report:
      - The Railway dashboard URL for the project
      - The public HTTPS URL for the MCP gateway
      - Health-check result
      - Any errors in the deploy logs

Hard guards:
- DO NOT commit any secrets to git
- DO NOT set OPENAI_API_KEY via the API (paste via dashboard only)
- DO NOT push to git
- DO NOT modify the local repo unless I confirm
- DO NOT delete or modify any existing Railway projects
```

---

## Manual alternative (no agent needed)

If you'd rather drive it yourself:

```bash
cd "C:\Users\reetu\Desktop\jak shield"

# 1. Log in (opens browser)
railway login

# 2. Create the project + link it
railway init                       # answer: jak-shield-mcp
# (or, if linking to an existing project)
railway link

# 3. Add postgres
railway add --plugin postgresql

# 4. Set env vars (generate secrets first via the node one-liner above)
railway variables set \
  SHIELD_MCP_HTTP_PORT=4101 \
  SHIELD_HTTP_HOST=0.0.0.0 \
  NODE_ENV=production \
  SHIELD_AUTH_OPTIONAL=0 \
  SHIELD_DEFAULT_TENANT_ID=public \
  OPENAI_MODEL=gpt-4o-mini

# Set secrets one at a time so they don't end up in shell history:
railway variables set JAK_SHIELD_JWT_SECRET=<paste>
railway variables set JAK_SHIELD_DECISION_HMAC=<paste>
railway variables set JAK_SHIELD_FIELD_KEY=<paste>
railway variables set JAK_SHIELD_COOKIE_SECRET=<paste>
railway variables set OPENAI_API_KEY=<paste-or-skip>

# DATABASE_URL is auto-set by Railway when you add postgres

# 5. Deploy
railway up

# 6. Get the domain
railway domain
# prints jak-shield-mcp-production.up.railway.app or similar

# 7. Smoke test
curl https://jak-shield-mcp-production.up.railway.app/health
```

---

## After deploy lands

### A. Update README install section

Replace the *"pending publish — see docs/PUBLISH_TO_SMITHERY.md"* line with the live URL:

```diff
- > **https://smithery.ai/servers/reetu004/jak-shield**  *(pending publish — see `docs/PUBLISH_TO_SMITHERY.md`)*
+ > **HTTP gateway:** https://jak-shield-mcp-production.up.railway.app/mcp/public
+ > **Smithery:** https://smithery.ai/servers/reetu004/jak-shield *(see [PUBLISH_TO_SMITHERY.md](./docs/PUBLISH_TO_SMITHERY.md))*
```

### B. Resubmit to Smithery as hosted (not stdio)

Now that the HTTPS URL is real, you can also list JAK Shield in Smithery's **Connectors** section (HTTP-based MCPs), not just the **Servers** section (stdio bundles). Open https://smithery.ai/mcp/connectors and submit:

- **Server URL:** `https://jak-shield-mcp-production.up.railway.app/mcp/public`
- **Namespace:** `reetu004`
- **Server ID:** `jak-shield`

This gives users two ways to install: stdio bundle (Claude Desktop / Cursor) OR HTTP connector (anywhere).

### C. Set up monitoring

Railway has built-in metrics. To set thresholds + alerts:

- Dashboard → service → **Metrics** tab → set alerts for:
  - HTTP error rate > 1% for 5 min
  - Memory > 80% for 10 min
  - CPU > 80% for 10 min

You can also wire alerts to Discord / Slack later via Railway's webhooks.

### D. Add a custom domain (optional)

If you own `jakshield.ai` or similar:

```bash
railway domain jakshield.ai
# prints the CNAME you need to add at your registrar
```

DNS propagates in 5–30 min. Railway auto-provisions a Let's Encrypt cert.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `mcp__railway__whoami` returns "Not authenticated" | CLI token expired or never set | Run `railway login` in your terminal |
| Build fails with "Cannot find module @jak-shield/..." | Workspace deps not bundled | Verify `Dockerfile.mcp` line 9: `pnpm --filter @jak-shield/mcp-server... build` (the `...` is critical — includes workspace deps) |
| Build succeeds but `/health` 502s for >2 min | Wrong PORT binding | Railway sets `PORT` automatically. Either edit `http.ts` to read `PORT` first, or set `SHIELD_MCP_HTTP_PORT=$PORT` in env vars |
| `assertSigningSecretReady()` throws on boot | NODE_ENV=production with dev defaults | Confirm all four `JAK_SHIELD_*` secrets are set in env vars and non-empty |
| `curl /health` works but `/mcp/<tenantId>` returns 401 | Auth is on (SHIELD_AUTH_OPTIONAL=0) and no API key in request | Either set `SHIELD_AUTH_OPTIONAL=1` for public testing, OR mint an API key via the dashboard |
| Deploys hang at "Building" >10 min | Workspace lock issues during pnpm install | Check `pnpm-lock.yaml` is committed; verify Railway is on the right branch |
| Postgres connection refused | DATABASE_URL not wired to the right service | Use a Railway reference variable: `${{ Postgres.DATABASE_URL }}` |

---

## Cost on Railway

Free tier: $5/mo of credit. JAK Shield's MCP gateway + postgres typically burns:

- mcp-http service: ~$3-5/mo at idle (256 MB RAM, < 1 vCPU)
- Postgres: ~$3-5/mo for the smallest instance
- Egress: depends on traffic

For dev / pre-customer testing, expect to be at or just over the free tier. Upgrade to Hobby plan ($5/mo flat + usage) once a real customer is on it.

---

## What I generated for this doc

The secrets shown earlier in this conversation context were *placeholders for the prompt*. **Regenerate fresh ones before deploy.** Specifically — run:

```bash
node -e "const c = require('crypto'); ['JAK_SHIELD_JWT_SECRET','JAK_SHIELD_DECISION_HMAC','JAK_SHIELD_FIELD_KEY','JAK_SHIELD_COOKIE_SECRET'].forEach(k => console.log(k+'='+c.randomBytes(32).toString('hex')));"
```

Save the output in your password manager. Paste into Railway's env-var UI. Never commit them.

`railway.json` (in repo root, committed) tells Railway which Dockerfile to use and what the healthcheck is. That's safe to commit — it has no secrets.
