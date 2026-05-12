import type { FastifyPluginAsync } from 'fastify';
import { renderPrometheus } from '@jak-shield/observability';

export const metricsRoute: FastifyPluginAsync = async (app) => {
  app.get('/metrics', async (_req, reply) => {
    reply.header('content-type', 'text/plain; version=0.0.4');
    return reply.send(renderPrometheus());
  });
};
