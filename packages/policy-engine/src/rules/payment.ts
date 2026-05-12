import { RiskLevel } from '@jak-shield/shared';
import { approvalDecision } from '@jak-shield/core';
import type { PolicyRule } from './index.js';

const PAYMENT_HINTS = ['payment', 'payout', 'transfer', 'charge', 'refund', 'invoice', 'stripe', 'paypal', 'razorpay'];

export const paymentRule: PolicyRule = {
  name: 'payment',
  description: 'Require approval for any payment / financial transaction',
  evaluate(req) {
    const lower = req.toolName.toLowerCase();
    if (!PAYMENT_HINTS.some((h) => lower.includes(h))) return null;
    return approvalDecision(
      `Financial action requires admin approval: ${req.toolName}`,
      'payment',
      RiskLevel.CRITICAL,
      'Confirm the amount, payee, and currency in the dashboard before approving.',
    );
  },
};
