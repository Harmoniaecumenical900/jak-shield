import type { FastifyPluginAsync } from 'fastify';
import { UserRole } from '@jak-shield/shared';
import { getPrisma } from '@jak-shield/approval-gateway';
import { resolveAuth, requireRoleAtLeast } from '../middleware/auth.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/members', { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.OPERATOR)] }, async (req) => {
    const prisma = getPrisma();
    const members = await prisma.tenantMember.findMany({
      where: { tenantId: req.auth!.tenantId },
      include: { user: { select: { id: true, email: true, name: true, lastLoginAt: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
  });

  app.put(
    '/members/:userId/role',
    { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] },
    async (req, reply) => {
      const { userId } = req.params as { userId: string };
      const body = req.body as { role: UserRole };
      const prisma = getPrisma();
      try {
        const updated = await prisma.tenantMember.update({
          where: { tenantId_userId: { tenantId: req.auth!.tenantId, userId } },
          data: { role: body.role },
        });
        return updated;
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    },
  );

  app.delete(
    '/members/:userId',
    { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] },
    async (req, reply) => {
      const { userId } = req.params as { userId: string };
      if (req.auth!.userId === userId) {
        return reply.code(400).send({ error: 'cannot_remove_self' });
      }
      const prisma = getPrisma();
      await prisma.tenantMember.delete({
        where: { tenantId_userId: { tenantId: req.auth!.tenantId, userId } },
      });
      return { ok: true };
    },
  );
};
