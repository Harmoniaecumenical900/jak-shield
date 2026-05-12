# JAK Shield deployment

JAK Shield ships three runnable services: the **Fastify API** (`:4100`), the
**MCP HTTP gateway** (`:4101`), and the **Next.js dashboard** (`:3000`). For
the local plug-in mode (Claude Desktop, Cursor) only the **MCP stdio binary**
is needed — see the main [README](../README.md).

This guide covers production deployment of the SaaS gateway.

---

## 1. Environment checklist

Required everywhere:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `JAK_SHIELD_FIELD_KEY` | 64-hex-char AES-256-GCM master key for at-rest encryption. **Generate once and store in your secrets manager.** |
| `JAK_SHIELD_JWT_SECRET` | Random ≥32-char string. Rotate annually. |
| `JAK_SHIELD_COOKIE_SECRET` | Random ≥32-char string. |

Recommended:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables the AI risk classifier. System still works if unset. |
| `OPENAI_MODEL` | Default `gpt-5.4`; pin to whatever your org uses. |
| `OPENAI_TIMEOUT_MS` | Default 1500 — classifier abandoned past this. |
| `SHIELD_DASHBOARD_URL` | Public dashboard URL (used in invite emails). |
| `SHIELD_CORPORATE_DOMAINS` | Comma-separated list of "internal" email domains. |
| `SHIELD_MCP_REQUIRE_AUTH` | `1` (default) requires API key on the MCP gateway. Set `0` only for sandboxed dev. |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error`. Default `info`. |

Generate the master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Database

```bash
pnpm install
pnpm --filter @jak-shield/approval-gateway prisma migrate deploy
pnpm --filter @jak-shield/approval-gateway prisma generate
```

Postgres ≥14 is required. Recommended setup: a managed Postgres (Render, Neon,
Supabase, RDS) with **logical backups enabled** and **point-in-time recovery**.

---

## 3. Deploy targets

### Docker Compose (single host)

The bundled `docker-compose.yml` boots Postgres + API + MCP HTTP + dashboard:

```bash
docker-compose up -d
docker-compose logs -f
```

Behind a reverse proxy (Caddy / nginx / Traefik):

| Path | Upstream | Notes |
|---|---|---|
| `dashboard.jakshield.ai/*` | `dashboard:3000` | Next.js |
| `api.jakshield.ai/*` | `api:4100` | Fastify REST |
| `mcp.jakshield.ai/mcp/*` | `mcp-http:4101` | MCP gateway, requires API key |

### Render (PaaS)

1. Provision a Postgres instance.
2. Create three Web Services from this repo:
   - **API** — `Dockerfile.api`, port `4100`.
   - **MCP** — `Dockerfile.mcp`, port `4101`.
   - **Dashboard** — `Dockerfile.dashboard`, port `3000`.
3. Set the env vars above on each service. The API and MCP both need
   `DATABASE_URL`; the dashboard needs `NEXT_PUBLIC_SHIELD_API` pointed at the
   API service URL.
4. Add a Pre-Deploy Job on the API service:
   `pnpm --filter @jak-shield/approval-gateway prisma migrate deploy`.

### Fly.io

```bash
fly launch --dockerfile Dockerfile.api --name jak-shield-api
fly launch --dockerfile Dockerfile.mcp --name jak-shield-mcp
fly launch --dockerfile Dockerfile.dashboard --name jak-shield-dashboard
fly secrets set DATABASE_URL=… JAK_SHIELD_FIELD_KEY=… JAK_SHIELD_JWT_SECRET=… -a jak-shield-api
fly secrets set DATABASE_URL=… JAK_SHIELD_FIELD_KEY=… -a jak-shield-mcp
```

Use Fly Postgres or an external managed Postgres.

### Vercel (dashboard only)

The Next.js dashboard can be deployed directly to Vercel; point
`NEXT_PUBLIC_SHIELD_API` at the API host. The API and MCP services are not
suitable for Vercel's serverless model — host them on Render/Fly/Docker.

### Self-hosted Kubernetes

A starter Helm chart is not in this repo yet. The three Dockerfiles map cleanly
to three Deployments + Services. Recommended: a single Postgres StatefulSet (or
external managed DB), one Service per app, and an Ingress with TLS termination
at the LB.

---

## 4. Post-deploy smoke test

```bash
# 1. Sign up
curl -X POST https://api.jakshield.ai/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@corp.com","password":"abcd1234","tenantName":"Corp"}'
# → 200 with token cookie

# 2. Create an API key (replace TOKEN)
curl -X POST https://api.jakshield.ai/api/api-keys \
  -H "Authorization: Bearer TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"prod","scopes":["mcp:invoke","approvals:read"]}'
# → returns { key: "jks_..." }

# 3. Hit the MCP gateway as that tenant
curl -X POST https://mcp.jakshield.ai/mcp/<tenantId> \
  -H "Authorization: Bearer jks_..." \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# → JSON-RPC list of shield.* + connector tools
```

---

## 5. Backups & DR

- **Postgres**: enable PITR. Schedule daily snapshots.
- **Field-encryption key**: store in a separate secrets manager (1Password,
  Doppler, AWS Secrets Manager). If lost, every encrypted credential becomes
  unreadable. **Have a documented break-glass for key rotation.**
- **JWT secret**: rotation invalidates all live sessions; users must re-login.
  Schedule rotations during a maintenance window.

---

## 6. Monitoring

- `GET /health` on both the API and MCP services — wire to your uptime monitor.
- Recommended dashboards (Grafana / Datadog):
  - p95 latency on `/api/evaluate` and `/mcp/*`
  - Block rate (deltas in `TOOL_CALL_BLOCKED` audit entries) — sudden spikes
    may indicate a misconfigured agent
  - Approval queue depth (`status=PENDING` count) — alert if backlog grows
  - Classifier timeout rate (`CLASSIFIER_TIMEOUT` audit entries)
- Log shipping: API + MCP write structured logs to stderr by default. Pipe to
  your aggregator (Loki, Datadog, CloudWatch).

---

## 7. Production hardening checklist

- [ ] All required env vars set, no defaults left in place
- [ ] `JAK_SHIELD_FIELD_KEY` rotated since first launch (and old key kept for read-only fallback during grace)
- [ ] `SHIELD_MCP_REQUIRE_AUTH=1` (the default) is enforced
- [ ] `helmet` CSP enabled (uncomment in `apps/api/src/server.ts` once dashboard URL is final)
- [ ] CORS origin restricted to `SHIELD_DASHBOARD_URL`
- [ ] Postgres `sslmode=require` enabled
- [ ] Rate limit middleware added in front of `/api/auth/*` (TODO — add `@fastify/rate-limit`)
- [ ] OAuth/SSO wired (TODO — Phase 4)
- [ ] Backups verified by restore drill
- [ ] DR runbook documented and tested
- [ ] Audit log retention policy configured (default: keep forever)
- [ ] Approval auto-expiry runs on a cron (POST `/api/approvals/expire-stale` every minute)

---

## 8. Phase 4 work (NOT included in this build)

- OAuth / SSO (Google, Microsoft, Okta SAML)
- Self-serve customer-portal billing (Stripe Checkout + customer portal — scaffolding is in `apps/api/src/routes/billing.ts`)
- IP allowlisting per API key
- Field-level audit-log redaction policies per tenant
- Compliance docs: SOC2 controls map, HIPAA BAA template, ISO 27001 SoA
- VAPT engagement results & remediation
- Customer pilot agreements
