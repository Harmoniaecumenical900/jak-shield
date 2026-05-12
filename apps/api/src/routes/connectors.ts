import type { FastifyPluginAsync } from 'fastify';
import { listConnectorTools } from '@jak-shield/connectors-registry';
import { listCredentials } from '@jak-shield/auth';
import { resolveAuth } from '../middleware/auth.js';
import { CONNECTOR_REQUIREMENTS } from '../connector-requirements.js';

export const connectorRoutes: FastifyPluginAsync = async (app) => {
  /** List all protected MCP tools currently registered. */
  app.get('/tools', async () => {
    return listConnectorTools().map((t) => ({
      name: t.name,
      description: t.description,
      riskClass: t.riskClass,
      inputSchema: t.inputSchema,
    }));
  });

  /** List connector requirements with per-tenant configuration status. */
  app.get('/', { preHandler: resolveAuth }, async (req) => {
    const stored = await listCredentials(req.auth!.tenantId);
    const storedNames = new Set(stored.map((s) => s.name));
    return CONNECTOR_REQUIREMENTS.map((r) => {
      const requiredNames = r.required.map((x) => x.name);
      const missing = requiredNames.filter((n) => !storedNames.has(n));
      return {
        ...r,
        configured: missing.length === 0,
        missing,
      };
    });
  });
};

// Backwards-compat alias for old GET / shape used by the dashboard's first version.
export const connectorRoutesLegacy: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return listConnectorTools().map((t) => ({
      name: t.name,
      description: t.description,
      riskClass: t.riskClass,
      inputSchema: t.inputSchema,
    }));
  });
};
