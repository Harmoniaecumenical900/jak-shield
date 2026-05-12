import type { FastifyPluginAsync } from 'fastify';
import { UserRole } from '@jak-shield/shared';
import { getPrisma } from '@jak-shield/approval-gateway';
import { resolveAuth, requireRoleAtLeast } from '../middleware/auth.js';

/**
 * Billing scaffolding. This wires Plan / Subscription / UsageCounter and a
 * Stripe webhook stub. Actual Stripe API calls are intentionally NOT made —
 * this exposes the integration surface so the SaaS team can plug in a real
 * Stripe key and customer-portal flow later without changing the data model.
 */

export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    monthlyDecisionsLimit: 5_000,
    teamSizeLimit: 3,
    apiKeysLimit: 2,
    classifierEnabled: true,
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    monthlyDecisionsLimit: 100_000,
    teamSizeLimit: 25,
    apiKeysLimit: 25,
    classifierEnabled: true,
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyDecisionsLimit: Number.POSITIVE_INFINITY,
    teamSizeLimit: Number.POSITIVE_INFINITY,
    apiKeysLimit: Number.POSITIVE_INFINITY,
    classifierEnabled: true,
  },
} as const;
type PlanId = keyof typeof PLANS;

function periodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
function periodEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/plans', async () => Object.values(PLANS).map(redactInfinity));

  app.get('/subscription', { preHandler: resolveAuth }, async (req) => {
    const prisma = getPrisma();
    const sub = await prisma.subscription.findUnique({ where: { tenantId: req.auth!.tenantId } });
    return sub ?? { plan: 'FREE', status: 'ACTIVE', tenantId: req.auth!.tenantId };
  });

  app.get('/usage', { preHandler: resolveAuth }, async (req) => {
    const prisma = getPrisma();
    const start = periodStart();
    const counters = await prisma.usageCounter.findMany({
      where: { tenantId: req.auth!.tenantId, periodStart: start },
    });
    const byMetric = Object.fromEntries(counters.map((c) => [c.metric, c.count]));
    const sub = await prisma.subscription.findUnique({ where: { tenantId: req.auth!.tenantId } });
    const plan = PLANS[(sub?.plan as PlanId) ?? 'FREE'];
    return {
      plan: plan.id,
      periodStart: start.toISOString(),
      periodEnd: periodEnd().toISOString(),
      counters: byMetric,
      limits: redactInfinity(plan),
    };
  });

  app.post(
    '/change-plan',
    { preHandler: [resolveAuth, requireRoleAtLeast(UserRole.TENANT_ADMIN)] },
    async (req, reply) => {
      const body = req.body as { plan: PlanId };
      if (!PLANS[body.plan]) return reply.code(400).send({ error: 'unknown_plan' });
      const prisma = getPrisma();
      const sub = await prisma.subscription.upsert({
        where: { tenantId: req.auth!.tenantId },
        create: { tenantId: req.auth!.tenantId, plan: body.plan, status: 'ACTIVE' },
        update: { plan: body.plan },
      });
      await prisma.tenant.update({ where: { id: req.auth!.tenantId }, data: { plan: body.plan } });
      return sub;
    },
  );

  /**
   * Stripe webhook stub. Verifies the signature header (stub: just presence)
   * and writes a no-op audit entry. Replace with the real `stripe.webhooks.constructEvent`
   * call when a Stripe key is added.
   */
  app.post('/stripe/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) return reply.code(400).send({ error: 'missing_signature' });
    // TODO: verify signature with STRIPE_WEBHOOK_SECRET
    // TODO: handle: customer.subscription.{created,updated,deleted}, invoice.payment_failed
    return { received: true, note: 'stub — wire real Stripe SDK to act on this' };
  });
};

export async function incrementUsage(tenantId: string, metric: string, by = 1): Promise<void> {
  const prisma = getPrisma();
  const start = periodStart();
  const end = periodEnd();
  await prisma.usageCounter.upsert({
    where: { tenantId_metric_periodStart: { tenantId, metric, periodStart: start } },
    create: { tenantId, metric, periodStart: start, periodEnd: end, count: by },
    update: { count: { increment: by } },
  });
}

function redactInfinity(p: (typeof PLANS)[PlanId]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, v === Number.POSITIVE_INFINITY ? -1 : v]),
  );
}
