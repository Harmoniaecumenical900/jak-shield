/**
 * Capability tokens — short-lived, scoped tokens that authorize ONE specific
 * tool call with ONE specific args hash. Even if the token is intercepted,
 * the attacker cannot use it for any other call. Single-use: after the
 * connector validates and runs, the token is burned.
 *
 * Format: jks-cap.<base64url(header)>.<base64url(payload)>.<base64url(hmac)>
 *
 * Payload claims:
 *   tid: tenant id
 *   tn:  tool name
 *   ah:  args hash (sha256 of canonicalized args, 16 hex chars)
 *   jti: single-use id (uuid-ish)
 *   exp: unix epoch seconds — defaults to now+60
 *   iat: unix epoch seconds
 *   iss: 'jak-shield'
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ISSUER = 'jak-shield';
const DEFAULT_TTL_SEC = 60;
const SECRET = (): Buffer => {
  const env = process.env.JAK_SHIELD_CAP_TOKEN_SECRET ?? process.env.JAK_SHIELD_JWT_SECRET ?? 'dev-cap-secret-change-me';
  return Buffer.from(env, 'utf8');
};

const BURNED = new Map<string, number>(); // jti → expiresAt
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = 0;
function prune(): void {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  for (const [jti, exp] of BURNED.entries()) if (exp * 1000 < now) BURNED.delete(jti);
  lastPrune = now;
}

function b64url(buf: Buffer | string): string {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  let pad = s.length % 4;
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  if (pad === 2) str += '==';
  else if (pad === 3) str += '=';
  else if (pad === 1) throw new Error('invalid base64url');
  return Buffer.from(str, 'base64');
}

export function hashArgs(args: unknown): string {
  const canonical = stableStringify(args);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export interface CapabilityClaims {
  tid: string;
  tn: string;
  ah: string;
  jti: string;
  exp: number;
  iat: number;
  iss: string;
}

export interface IssueCapabilityInput {
  tenantId: string;
  toolName: string;
  args: unknown;
  ttlSeconds?: number;
}

export function issueCapability(input: IssueCapabilityInput): string {
  const header = { alg: 'HS256', typ: 'JKS-CAP' };
  const now = Math.floor(Date.now() / 1000);
  const claims: CapabilityClaims = {
    tid: input.tenantId,
    tn: input.toolName,
    ah: hashArgs(input.args),
    jti: `cap_${randomBytes(8).toString('hex')}`,
    exp: now + (input.ttlSeconds ?? DEFAULT_TTL_SEC),
    iat: now,
    iss: ISSUER,
  };
  const headerEnc = b64url(JSON.stringify(header));
  const payloadEnc = b64url(JSON.stringify(claims));
  const sig = createHmac('sha256', SECRET()).update(`${headerEnc}.${payloadEnc}`).digest();
  return `${headerEnc}.${payloadEnc}.${b64url(sig)}`;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  claims?: CapabilityClaims;
}

export function verifyCapability(
  token: string,
  expected: { tenantId: string; toolName: string; args: unknown },
): VerifyResult {
  prune();
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  try {
    const sig = b64urlDecode(parts[2]!);
    const expectedSig = createHmac('sha256', SECRET())
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    if (sig.length !== expectedSig.length || !timingSafeEqual(sig, expectedSig)) {
      return { ok: false, reason: 'bad signature' };
    }
    const claims = JSON.parse(b64urlDecode(parts[1]!).toString('utf8')) as CapabilityClaims;
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== ISSUER) return { ok: false, reason: 'wrong issuer' };
    if (claims.exp <= now) return { ok: false, reason: 'expired' };
    if (claims.tid !== expected.tenantId) return { ok: false, reason: 'tenant mismatch' };
    if (claims.tn !== expected.toolName) return { ok: false, reason: 'tool mismatch' };
    if (claims.ah !== hashArgs(expected.args)) return { ok: false, reason: 'args mismatch' };
    if (BURNED.has(claims.jti)) return { ok: false, reason: 'already used' };
    BURNED.set(claims.jti, claims.exp);
    return { ok: true, claims };
  } catch (err) {
    return { ok: false, reason: `parse error: ${(err as Error).message}` };
  }
}

export function isCapabilityToken(s: string): boolean {
  return typeof s === 'string' && s.split('.').length === 3 && s.startsWith('eyJ'); // header always starts {"alg"
}
