import type { FastifyPluginAsync } from 'fastify';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    ok: true,
    service: 'jak-shield-api',
    timestamp: new Date().toISOString(),
    classifierConfigured: Boolean(process.env.OPENAI_API_KEY),
    db: process.env.DATABASE_URL ? 'configured' : 'in-memory',
  }));
};
