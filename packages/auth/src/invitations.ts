import { createHash, randomBytes } from 'node:crypto';
import { UserRole } from '@jak-shield/shared';
import { getPrisma } from '@jak-shield/approval-gateway';
import { hashPassword } from './passwords.js';

const INVITE_TTL_HOURS = Number(process.env.JAK_SHIELD_INVITE_TTL_HOURS ?? 72);
const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;

export interface CreateInvitationResult {
  id: string;
  email: string;
  role: UserRole;
  /** Returned ONCE — share via email/Slack/etc. */
  acceptUrl: string;
  expiresAt: string;
}

export async function createInvitation(input: {
  tenantId: string;
  email: string;
  role: UserRole;
  invitedById: string;
  baseUrl?: string;
}): Promise<CreateInvitationResult> {
  const prisma = getPrisma();
  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  const created = await prisma.invitation.create({
    data: {
      tenantId: input.tenantId,
      email: input.email.toLowerCase().trim(),
      role: input.role,
      tokenHash,
      invitedById: input.invitedById,
      expiresAt,
    },
  });
  const baseUrl = input.baseUrl ?? process.env.SHIELD_DASHBOARD_URL ?? 'http://localhost:3000';
  return {
    id: created.id,
    email: created.email,
    role: created.role as UserRole,
    acceptUrl: `${baseUrl}/invite/${token}`,
    expiresAt: created.expiresAt.toISOString(),
  };
}

export async function listInvitations(tenantId: string) {
  const prisma = getPrisma();
  return prisma.invitation.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
    },
  });
}

export async function revokeInvitation(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.invitation.delete({ where: { id } });
}

export interface AcceptInvitationInput {
  token: string;
  password?: string; // required if user does not yet exist
  name?: string;
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<{ userId: string; tenantId: string }> {
  const prisma = getPrisma();
  const tokenHash = createHash('sha256').update(input.token).digest('hex');
  const inv = await prisma.invitation.findUnique({ where: { tokenHash } });
  if (!inv) throw new Error('Invitation not found');
  if (inv.acceptedAt) throw new Error('Invitation already used');
  if (inv.expiresAt < new Date()) throw new Error('Invitation expired');

  let user = await prisma.user.findUnique({ where: { email: inv.email } });
  if (!user) {
    if (!input.password) throw new Error('Password required for new user');
    user = await prisma.user.create({
      data: {
        id: newId('usr'),
        tenantId: inv.tenantId,
        email: inv.email,
        passwordHash: await hashPassword(input.password),
        name: input.name,
      },
    });
  }
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: inv.tenantId, userId: user.id } },
    create: { tenantId: inv.tenantId, userId: user.id, role: inv.role },
    update: { role: inv.role },
  });
  await prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  return { userId: user.id, tenantId: inv.tenantId };
}
