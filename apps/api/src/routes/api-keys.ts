import type { FastifyPluginAsync } from 'fastify';
import { ALL_SCOPES, createApiKey, listApiKeys, revokeApiKey, type ApiKeyScope } from '@jak-shield/auth';
import { UserRole } from '@jak-shield/shared';
import { resolveAuth, requireRoleAtLeast } from '../middleware/auth.js';

export const apiKeyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.OPERATOR)] }, async (req) => {
    return listApiKeys(req.auth!.tenantId);
  });

  app.post('/', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] }, async (req, reply) => {
    const body = req.body as { name: string; scopes: ApiKeyScope[] };
    const scopes = (body.scopes ?? []).filter((s) => ALL_SCOPES.includes(s));
    if (scopes.length === 0) return reply.code(400).send({ error: 'at_least_one_scope_required' });
    const created = await createApiKey({
      tenantId: req.auth!.tenantId,
      name: body.name,
      scopes,
      createdBy: req.auth!.userId,
    });
    return created; // contains plaintext key — show once.
  });

  app.delete('/:id', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] }, async (req) => {
    const { id } = req.params as { id: string };
    await revokeApiKey(id);
    return { ok: true };
  });

  app.get('/scopes', async () => ALL_SCOPES);
};
