import { createHash, randomBytes } from 'node:crypto';
import { getPrisma } from '@jak-shield/approval-gateway';

export type ApiKeyScope =
  | 'mcp:invoke'
  | 'approvals:read'
  | 'approvals:decide'
  | 'audit:read'
  | 'connectors:manage'
  | 'admin';

export const ALL_SCOPES: ApiKeyScope[] = [
  'mcp:invoke',
  'approvals:read',
  'approvals:decide',
  'audit:read',
  'connectors:manage',
  'admin',
];

const PREFIX = 'jks_';

export interface CreateApiKeyResult {
  id: string;
  name: string;
  /** Returned ONCE, never retrievable again. */
  key: string;
  prefix: string;
  scopes: ApiKeyScope[];
}

export async function createApiKey(input: {
  tenantId: string;
  name: string;
  scopes: ApiKeyScope[];
  createdBy?: string;
}): Promise<CreateApiKeyResult> {
  const raw = randomBytes(24).toString('base64url');
  const key = `${PREFIX}${raw}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.slice(0, 12);

  const prisma = getPrisma();
  const created = await prisma.apiKey.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      keyHash,
      keyPrefix,
      scopes: input.scopes,
      createdBy: input.createdBy,
    },
  });

  return {
    id: created.id,
    name: created.name,
    key,
    prefix: created.keyPrefix,
    scopes: created.scopes as ApiKeyScope[],
  };
}

export async function listApiKeys(tenantId: string) {
  const prisma = getPrisma();
  return prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdBy: true,
    },
  });
}

export async function revokeApiKey(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}

export interface ApiKeyValidation {
  valid: boolean;
  tenantId?: string;
  scopes?: ApiKeyScope[];
  apiKeyId?: string;
}

export async function validateApiKey(rawKey: string): Promise<ApiKeyValidation> {
  if (!rawKey || !rawKey.startsWith(PREFIX)) return { valid: false };
  const keyHash = hashApiKey(rawKey);
  const prisma = getPrisma();
  const found = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!found || found.revokedAt) return { valid: false };
  // Touch lastUsedAt asynchronously; do not block the auth path.
  prisma.apiKey
    .update({ where: { id: found.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return {
    valid: true,
    tenantId: found.tenantId,
    scopes: found.scopes as ApiKeyScope[],
    apiKeyId: found.id,
  };
}

export function hasScope(scopes: ApiKeyScope[], required: ApiKeyScope): boolean {
  return scopes.includes('admin') || scopes.includes(required);
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
