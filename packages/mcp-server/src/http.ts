#!/usr/bin/env node
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createShieldServer } from './server.js';
import { createLogger, UserRole } from '@jak-shield/shared';
import { hasScope, validateApiKey } from '@jak-shield/auth';
import { setTenantContext, clearTenantContext } from './tenant-context.js';

const log = createLogger('mcp-http');

const PORT = Number(process.env.SHIELD_MCP_HTTP_PORT ?? 4101);
const HOST = process.env.SHIELD_MCP_HTTP_HOST ?? '0.0.0.0';
const REQUIRE_AUTH = process.env.SHIELD_MCP_REQUIRE_AUTH !== '0';

interface TransportEntry {
  transport: StreamableHTTPServerTransport;
  tenantId: string;
}
const transports = new Map<string, TransportEntry>();

async function getOrCreateTransport(tenantId: string): Promise<StreamableHTTPServerTransport> {
  const existing = transports.get(tenantId);
  if (existing) return existing.transport;
  const server = createShieldServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  });
  await server.connect(transport);
  transports.set(tenantId, { transport, tenantId });
  return transport;
}

async function main(): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'jak-shield-mcp', tenants: transports.size }));
      return;
    }

    // /mcp                 → uses the default tenant
    // /mcp/:tenantId       → routes to that tenant
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = url.pathname.match(/^\/mcp(?:\/([^/]+))?\/?$/);
    if (!m) {
      res.writeHead(404).end('Not found. POST /mcp or /mcp/:tenantId for the MCP gateway.');
      return;
    }

    let tenantId = m[1] ?? process.env.SHIELD_DEFAULT_TENANT_ID ?? 'local';

    if (REQUIRE_AUTH) {
      const authHeader = req.headers['authorization'];
      const apiKey =
        (typeof authHeader === 'string' && /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]) ||
        (typeof req.headers['x-api-key'] === 'string' ? (req.headers['x-api-key'] as string) : null);
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized', hint: 'Pass Authorization: Bearer jks_...' }));
        return;
      }
      const v = await validateApiKey(apiKey);
      if (!v.valid || !v.tenantId) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_api_key' }));
        return;
      }
      if (m[1] && v.tenantId !== m[1]) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'wrong_tenant', expected: v.tenantId }));
        return;
      }
      if (!v.scopes || !hasScope(v.scopes, 'mcp:invoke')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'missing_scope', required: 'mcp:invoke' }));
        return;
      }
      tenantId = v.tenantId;
    }

    setTenantContext({ tenantId, role: UserRole.OPERATOR });
    try {
      const transport = await getOrCreateTransport(tenantId);
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = Buffer.concat(chunks).toString('utf-8');
      const parsed = body ? JSON.parse(body) : undefined;
      await transport.handleRequest(req, res, parsed);
    } catch (err) {
      log.error('http handler failed', (err as Error).message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    } finally {
      clearTenantContext();
    }
  });

  httpServer.listen(PORT, HOST, () => {
    log.info(`JAK Shield MCP HTTP gateway listening on http://${HOST}:${PORT}/mcp`);
    log.info(`Per-tenant URL format: http://${HOST}:${PORT}/mcp/<tenantId>`);
    log.info(REQUIRE_AUTH ? 'API key auth REQUIRED (Authorization: Bearer jks_...)' : 'API key auth DISABLED (SHIELD_MCP_REQUIRE_AUTH=0)');
  });
}

main().catch((err) => {
  log.error('fatal', err);
  process.exit(1);
});
