import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { createLogger } from '@jak-shield/shared';
import { assertSigningSecretReady } from '@jak-shield/core';
import { registerAllConnectors } from '@jak-shield/connectors-bundle';
import { httpRequestCounter } from '@jak-shield/observability';
import { approvalsRoutes } from './routes/approvals.js';
import { auditRoutes } from './routes/audit.js';
import { policyRoutes } from './routes/policies.js';
import { connectorRoutes } from './routes/connectors.js';
import { evaluateRoutes } from './routes/evaluate.js';
import { healthRoute } from './routes/health.js';
import { sseRoutes } from './routes/sse.js';
import { authRoutes } from './routes/auth.js';
import { teamRoutes } from './routes/teams.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { credentialRoutes } from './routes/credentials.js';
import { analyticsRoutes } from './routes/analytics.js';
import { auditSearchRoutes } from './routes/audit-search.js';
import { billingRoutes } from './routes/billing.js';
import { metricsRoute } from './routes/metrics.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';

const log = createLogger('api');

const PORT = Number(process.env.SHIELD_API_PORT ?? 4100);
const HOST = process.env.SHIELD_API_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  // Fail-boot if production secrets aren't configured.
  assertSigningSecretReady();
  registerAllConnectors();

  const app = Fastify({ logger: false });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: process.env.JAK_SHIELD_COOKIE_SECRET ?? 'dev-cookie-secret-change-me' });
  await app.register(cors, {
    origin: process.env.SHIELD_DASHBOARD_URL ?? true,
    credentials: true,
  });

  // Structured request log + per-request metric.
  app.addHook('onRequest', (req, _reply, done) => {
    (req as unknown as { __start: number }).__start = Date.now();
    done();
  });
  app.addHook('onResponse', (req, reply, done) => {
    const start = (req as unknown as { __start: number }).__start ?? Date.now();
    const elapsed = Date.now() - start;
    const route = (req.routeOptions?.url ?? req.url ?? 'unknown').replace(/\/[\da-f-]{8,}/g, '/:id');
    httpRequestCounter.inc({ method: req.method, route, status: String(reply.statusCode) });
    log.debug(`${req.method} ${req.url} → ${reply.statusCode} (${elapsed}ms)`);
    done();
  });

  // Rate limiting on all /api/* routes (excludes /health, /metrics).
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url?.startsWith('/api/')) return;
    await rateLimitMiddleware(req, reply);
  });

  app.register(healthRoute);
  app.register(metricsRoute);
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(approvalsRoutes, { prefix: '/api/approvals' });
  app.register(auditRoutes, { prefix: '/api/audit' });
  app.register(auditSearchRoutes, { prefix: '/api/audit-search' });
  app.register(policyRoutes, { prefix: '/api/policies' });
  app.register(connectorRoutes, { prefix: '/api/connectors' });
  app.register(credentialRoutes, { prefix: '/api/credentials' });
  app.register(evaluateRoutes, { prefix: '/api/evaluate' });
  app.register(teamRoutes, { prefix: '/api/teams' });
  app.register(apiKeyRoutes, { prefix: '/api/api-keys' });
  app.register(analyticsRoutes, { prefix: '/api/analytics' });
  app.register(billingRoutes, { prefix: '/api/billing' });
  app.register(sseRoutes, { prefix: '/api/stream' });

  // Graceful shutdown.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
      log.info(`Received ${signal}, draining…`);
      await app.close();
      process.exit(0);
    });
  }

  await app.listen({ port: PORT, host: HOST });
  log.info(`JAK Shield API listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  log.error('fatal', err);
  process.exit(1);
});
