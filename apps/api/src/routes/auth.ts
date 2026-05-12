import type { FastifyPluginAsync } from 'fastify';
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  listUserMemberships,
  login,
  revokeInvitation,
  signup,
  switchTenant,
} from '@jak-shield/auth';
import { UserRole } from '@jak-shield/shared';
import { resolveAuth, requireRoleAtLeast, SESSION_COOKIE_NAME } from '../middleware/auth.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 12,
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/signup', async (req, reply) => {
    const body = req.body as { email: string; password: string; tenantName: string; name?: string };
    try {
      const result = await signup(body);
      reply.setCookie(SESSION_COOKIE_NAME, result.token, cookieOptions);
      return { token: result.token, user: result.user, tenant: result.tenant, claims: result.claims };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post('/login', async (req, reply) => {
    const body = req.body as { email: string; password: string };
    try {
      const result = await login(body);
      reply.setCookie(SESSION_COOKIE_NAME, result.token, cookieOptions);
      return { token: result.token, user: result.user, tenant: result.tenant, claims: result.claims };
    } catch (err) {
      return reply.code(401).send({ error: (err as Error).message });
    }
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: resolveAuth }, async (req) => {
    const auth = req.auth!;
    const memberships = auth.userId ? await listUserMemberships(auth.userId) : [];
    return {
      auth,
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        role: m.role,
        tenantName: m.tenant.name,
        tenantPlan: m.tenant.plan,
      })),
    };
  });

  app.post('/switch-tenant', { preHandler: resolveAuth }, async (req, reply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'session_required' });
    const body = req.body as { tenantId: string };
    try {
      const result = await switchTenant(req.auth.userId, body.tenantId);
      reply.setCookie(SESSION_COOKIE_NAME, result.token, cookieOptions);
      return { tenant: result.tenant, claims: result.claims };
    } catch (err) {
      return reply.code(403).send({ error: (err as Error).message });
    }
  });

  app.post(
    '/invitations',
    { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] },
    async (req, reply) => {
      if (!req.auth?.userId) return reply.code(401).send({ error: 'session_required' });
      const body = req.body as { email: string; role: UserRole };
      const inv = await createInvitation({
        tenantId: req.auth.tenantId,
        email: body.email,
        role: body.role ?? UserRole.END_USER,
        invitedById: req.auth.userId,
      });
      return inv;
    },
  );

  app.get('/invitations', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.OPERATOR)] }, async (req) => {
    return listInvitations(req.auth!.tenantId);
  });

  app.delete('/invitations/:id', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] }, async (req) => {
    const { id } = req.params as { id: string };
    await revokeInvitation(id);
    return { ok: true };
  });

  app.post('/invitations/accept', async (req, reply) => {
    const body = req.body as { token: string; password?: string; name?: string };
    try {
      const result = await acceptInvitation(body);
      return result;
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
};
