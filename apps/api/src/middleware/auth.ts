import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@jak-shield/shared';
import { verifySession, validateApiKey, hasScope, type ApiKeyScope } from '@jak-shield/auth';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      kind: 'session' | 'apiKey';
      userId?: string;
      email?: string;
      tenantId: string;
      role: UserRole;
      scopes?: ApiKeyScope[];
      apiKeyId?: string;
    };
  }
}

const COOKIE_NAME = 'jak_shield_session';

function extractToken(req: FastifyRequest): { sessionToken?: string; apiKey?: string } {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (m) {
      const token = m[1]!;
      if (token.startsWith('jks_')) return { apiKey: token };
      return { sessionToken: token };
    }
  }
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.startsWith('jks_')) {
    return { apiKey: apiKeyHeader };
  }
  const cookieJar = (req as FastifyRequest & { cookies?: Record<string, string> }).cookies;
  if (cookieJar?.[COOKIE_NAME]) return { sessionToken: cookieJar[COOKIE_NAME] };
  return {};
}

export async function resolveAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { sessionToken, apiKey } = extractToken(req);

  if (sessionToken) {
    const claims = verifySession(sessionToken);
    if (claims) {
      req.auth = {
        kind: 'session',
        userId: claims.sub,
        email: claims.email,
        tenantId: claims.tenantId,
        role: claims.role,
      };
      return;
    }
  }

  if (apiKey) {
    const v = await validateApiKey(apiKey);
    if (v.valid && v.tenantId) {
      req.auth = {
        kind: 'apiKey',
        tenantId: v.tenantId,
        role: UserRole.OPERATOR,
        scopes: v.scopes,
        apiKeyId: v.apiKeyId,
      };
      return;
    }
  }

  // Local-mode fallback: if no DB and no auth presented, allow with default tenant.
  if (process.env.SHIELD_AUTH_OPTIONAL === '1') {
    req.auth = {
      kind: 'session',
      userId: process.env.SHIELD_DEFAULT_USER_ID ?? 'local-user',
      email: 'local@local',
      tenantId: process.env.SHIELD_DEFAULT_TENANT_ID ?? 'local',
      role: (process.env.SHIELD_DEFAULT_USER_ROLE as UserRole) ?? UserRole.TENANT_ADMIN,
    };
    return;
  }

  reply.code(401).send({ error: 'unauthorized' });
}

export function requireScope(scope: ApiKeyScope) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'unauthorized' });
    if (req.auth.kind === 'apiKey') {
      if (!req.auth.scopes || !hasScope(req.auth.scopes, scope)) {
        return reply.code(403).send({ error: 'forbidden', requiredScope: scope });
      }
    }
    // Sessions are evaluated by role downstream.
  };
}

export function requireRoleAtLeast(role: UserRole) {
  const order = [
    UserRole.EXTERNAL_AUDITOR,
    UserRole.END_USER,
    UserRole.REVIEWER,
    UserRole.OPERATOR,
    UserRole.TENANT_ADMIN,
  ];
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'unauthorized' });
    if (order.indexOf(req.auth.role) < order.indexOf(role)) {
      return reply.code(403).send({ error: 'forbidden', requiredRole: role });
    }
  };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
