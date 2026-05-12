import type { FastifyReply, FastifyRequest } from 'fastify';
import { consume, rateLimitCounter } from '@jak-shield/observability';

/**
 * Rate limit by API key (or by session userId, or by IP as last resort).
 *  - 60 requests / minute by default (1 req/s with burst 60)
 *  - /api/auth/* is more strict (10 req/min) to slow credential-stuffing
 */
export async function rateLimitMiddleware(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = req.url ?? '';
  const isAuth = url.startsWith('/api/auth/');
  const config = isAuth
    ? { capacity: 10, refillPerSecond: 10 / 60 }
    : { capacity: 60, refillPerSecond: 1 };

  const key =
    req.auth?.apiKeyId ??
    req.auth?.userId ??
    (req.headers['x-forwarded-for'] as string | undefined) ??
    req.ip ??
    'anonymous';
  const result = consume(`${key}:${isAuth ? 'auth' : 'api'}`, 1, config);
  if (!result.allowed) {
    rateLimitCounter.inc({ route: isAuth ? 'auth' : 'api' });
    reply.header('retry-after', Math.ceil(result.resetMs / 1000));
    reply.code(429).send({ error: 'rate_limited', retry_after_ms: result.resetMs });
  }
}
