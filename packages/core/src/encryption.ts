import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = 'enc:v1:';
const KEY_ENV = 'JAK_SHIELD_FIELD_KEY';

let cachedKey: Buffer | null | undefined;

function loadKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64 || !/^[0-9a-f]{64}$/i.test(hex)) {
    cachedKey = null;
    return null;
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

export function __resetFieldCipherKeyCache(): void {
  cachedKey = undefined;
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function isFieldEncryptionEnabled(): boolean {
  return loadKey() !== null;
}

export function encryptString(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext == null) return plaintext;
  if (typeof plaintext !== 'string') return plaintext;
  if (plaintext.length === 0) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;

  const key = loadKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, ct, tag]).toString('base64');
  return `${PREFIX}${blob}`;
}

export function decryptString(stored: string | null | undefined): string | null | undefined {
  if (stored == null) return stored;
  if (typeof stored !== 'string') return stored;
  if (!isEncrypted(stored)) return stored;

  const key = loadKey();
  if (!key) return stored;

  const blob = Buffer.from(stored.slice(PREFIX.length), 'base64');
  if (blob.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('encryption: decrypt failed (envelope too short)');
  }
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ct = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function encryptJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'enc' in (value as Record<string, unknown>) &&
    typeof (value as { enc: unknown }).enc === 'string' &&
    isEncrypted((value as { enc: string }).enc)
  ) {
    return value;
  }
  if (!isFieldEncryptionEnabled()) return value;
  const ct = encryptString(JSON.stringify(value));
  return { enc: ct };
}

export function decryptJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length !== 1 || typeof obj['enc'] !== 'string' || !isEncrypted(obj['enc'])) {
    return value;
  }
  const plain = decryptString(obj['enc']);
  if (typeof plain !== 'string') return value;
  try {
    return JSON.parse(plain);
  } catch {
    return plain;
  }
}
