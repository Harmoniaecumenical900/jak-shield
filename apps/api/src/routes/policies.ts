import type { FastifyPluginAsync } from 'fastify';
import { ALL_RULES } from '@jak-shield/policy-engine';

export const policyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return ALL_RULES.map((r) => ({
      name: r.name,
      description: r.description,
      enabled: true,
    }));
  });

  app.get('/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const rule = ALL_RULES.find((r) => r.name === name);
    if (!rule) return reply.code(404).send({ error: 'not_found' });
    return { name: rule.name, description: rule.description, enabled: true };
  });
};
