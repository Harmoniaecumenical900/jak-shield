import { UserRole } from '@jak-shield/shared';
import { getPrisma } from '@jak-shield/approval-gateway';
import { hashPassword, verifyPassword } from './passwords.js';
import { signSession, type SessionClaims } from './tokens.js';
import { randomBytes } from 'node:crypto';

export interface SignupInput {
  email: string;
  password: string;
  tenantName: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SessionResult {
  token: string;
  claims: SessionClaims;
  user: { id: string; email: string; name?: string };
  tenant: { id: string; name: string; plan: string };
}

const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;

export async function signup(input: SignupInput): Promise<SessionResult> {
  const prisma = getPrisma();
  const email = input.email.toLowerCase().trim();
  if (!email.includes('@')) throw new Error('Invalid email');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('User already exists');

  const tenantId = newId('ten');
  const userId = newId('usr');
  const passwordHash = await hashPassword(input.password);

  await prisma.tenant.create({
    data: { id: tenantId, name: input.tenantName, plan: 'FREE' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      email,
      name: input.name,
      passwordHash,
    },
  });
  await prisma.tenantMember.create({
    data: { tenantId, userId, role: UserRole.TENANT_ADMIN },
  });
  await prisma.subscription.create({
    data: { tenantId, plan: 'FREE', status: 'ACTIVE' },
  });

  return buildSession(userId, tenantId);
}

export async function login(input: LoginInput): Promise<SessionResult> {
  const prisma = getPrisma();
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new Error('Invalid credentials');
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new Error('Invalid credentials');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return buildSession(user.id, user.tenantId);
}

export async function buildSession(userId: string, tenantId: string): Promise<SessionResult> {
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const member = await prisma.tenantMember.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
  const role = (member?.role ?? UserRole.END_USER) as UserRole;
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const token = signSession({ sub: user.id, email: user.email, tenantId, role });
  return {
    token,
    claims: { sub: user.id, email: user.email, tenantId, role, type: 'session' },
    user: { id: user.id, email: user.email, name: user.name ?? undefined },
    tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
  };
}

export async function listUserMemberships(userId: string) {
  const prisma = getPrisma();
  return prisma.tenantMember.findMany({
    where: { userId },
    include: { tenant: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function switchTenant(userId: string, tenantId: string): Promise<SessionResult> {
  const prisma = getPrisma();
  const member = await prisma.tenantMember.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
  if (!member) throw new Error('Not a member of this tenant');
  return buildSession(userId, tenantId);
}
