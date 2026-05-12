import { encryptString, decryptString, isFieldEncryptionEnabled } from '@jak-shield/core';
import { getPrisma } from '@jak-shield/approval-gateway';

/**
 * Per-tenant credential store. Values are encrypted at rest with the AES-256-GCM
 * field cipher (env JAK_SHIELD_FIELD_KEY). If the key is unset, values are stored
 * in cleartext — this is fine for local dev but warned against in production.
 */
export async function setCredential(input: {
  tenantId: string;
  name: string;          // e.g. "GITHUB_TOKEN"
  value: string;         // plaintext; encrypted before persistence
  connectorId?: string;
}): Promise<{ id: string; name: string; encrypted: boolean }> {
  const prisma = getPrisma();
  const encrypted = encryptString(input.value);
  const upserted = await prisma.encryptedCredential.upsert({
    where: { tenantId_name: { tenantId: input.tenantId, name: input.name } },
    create: {
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      name: input.name,
      encryptedVal: encrypted ?? '',
    },
    update: {
      encryptedVal: encrypted ?? '',
      rotatedAt: new Date(),
    },
  });
  return { id: upserted.id, name: upserted.name, encrypted: isFieldEncryptionEnabled() };
}

export async function getCredential(tenantId: string, name: string): Promise<string | null> {
  const prisma = getPrisma();
  const found = await prisma.encryptedCredential.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  if (!found) return null;
  const plain = decryptString(found.encryptedVal);
  return typeof plain === 'string' ? plain : null;
}

export async function listCredentials(tenantId: string) {
  const prisma = getPrisma();
  const rows = await prisma.encryptedCredential.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, connectorId: true, createdAt: true, rotatedAt: true },
  });
  return rows;
}

export async function deleteCredential(tenantId: string, name: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.encryptedCredential.delete({ where: { tenantId_name: { tenantId, name } } });
}

/**
 * Materialize tenant credentials into process.env BEFORE running a connector.
 * Restores the previous values when the returned dispose() is called.
 */
export async function withTenantCredentials<T>(tenantId: string, names: string[], fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const name of names) {
    const val = await getCredential(tenantId, name);
    if (val == null) continue;
    previous.set(name, process.env[name]);
    process.env[name] = val;
  }
  try {
    return await fn();
  } finally {
    for (const [name, prev] of previous.entries()) {
      if (prev === undefined) delete process.env[name];
      else process.env[name] = prev;
    }
  }
}
