import type { FastifyPluginAsync } from 'fastify';
import { UserRole } from '@jak-shield/shared';
import { deleteCredential, listCredentials, setCredential } from '@jak-shield/auth';
import { resolveAuth, requireRoleAtLeast } from '../middleware/auth.js';

export const credentialRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.OPERATOR)] }, async (req) => {
    return listCredentials(req.auth!.tenantId);
  });

  app.put('/:name', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const body = req.body as { value: string; connectorId?: string };
    if (!body.value || typeof body.value !== 'string') {
      return reply.code(400).send({ error: 'value_required' });
    }
    const result = await setCredential({
      tenantId: req.auth!.tenantId,
      name,
      value: body.value,
      connectorId: body.connectorId,
    });
    return result;
  });

  app.delete('/:name', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] }, async (req) => {
    const { name } = req.params as { name: string };
    await deleteCredential(req.auth!.tenantId, name);
    return { ok: true };
  });
};
