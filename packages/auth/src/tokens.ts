import jwt from 'jsonwebtoken';
import { UserRole } from '@jak-shield/shared';

const SECRET = process.env.JAK_SHIELD_JWT_SECRET ?? 'dev-jwt-secret-change-me';
const ISSUER = 'jak-shield';
const TTL_SECONDS = Number(process.env.JAK_SHIELD_JWT_TTL_SECONDS ?? 60 * 60 * 12); // 12h

export interface SessionClaims {
  sub: string;             // userId
  email: string;
  tenantId: string;        // active tenant
  role: UserRole;
  type: 'session';
  iat?: number;
  exp?: number;
}

export function signSession(claims: Omit<SessionClaims, 'type' | 'iat' | 'exp'>): string {
  const payload: SessionClaims = { ...claims, type: 'session' };
  return jwt.sign(payload, SECRET, { issuer: ISSUER, expiresIn: TTL_SECONDS });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, SECRET, { issuer: ISSUER }) as SessionClaims;
    if (decoded.type !== 'session') return null;
    return decoded;
  } catch {
    return null;
  }
}
