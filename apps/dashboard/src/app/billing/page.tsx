'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  monthlyDecisionsLimit: number;
  teamSizeLimit: number;
  apiKeysLimit: number;
}

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
}

interface Usage {
  plan: string;
  periodStart: string;
  periodEnd: string;
  counters: Record<string, number>;
  limits: Record<string, number>;
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setPlans(await api.get<Plan[]>('/api/billing/plans'));
    setSub(await api.get<Subscription>('/api/billing/subscription'));
    setUsage(await api.get<Usage>('/api/billing/usage'));
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function changePlan(planId: string) {
    if (!confirm(`Switch to ${planId}?`)) return;
    await api.post('/api/billing/change-plan', { plan: planId });
    await load();
  }

  return (
    <div>
      <h1>Billing</h1>
      {err && <div className="auth-error">{err}</div>}

      <div className="card">
        <strong>Current plan</strong>
        <div style={{ marginTop: 8, fontSize: 24 }}>{sub?.plan ?? '—'}</div>
        <div className="muted">{sub?.status ?? ''}</div>
      </div>

      {usage && (
        <div className="card">
          <strong>Usage this period</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            {new Date(usage.periodStart).toLocaleDateString()} – {new Date(usage.periodEnd).toLocaleDateString()}
          </div>
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <UsageStat label="Decisions" value={usage.counters.decisions ?? 0} limit={usage.limits.monthlyDecisionsLimit} />
            <UsageStat label="Approvals queued" value={usage.counters.approvals_created ?? 0} />
            <UsageStat label="Classifier calls" value={usage.counters.classifier_calls ?? 0} />
            <UsageStat label="Redactions" value={usage.counters.redactions ?? 0} />
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Plans</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {plans.map((p) => (
          <div className="card" key={p.id}>
            <strong>{p.name}</strong>
            <ul style={{ paddingLeft: 18, fontSize: 13, marginTop: 8 }}>
              <li>{fmtLimit(p.monthlyDecisionsLimit)} decisions / month</li>
              <li>{fmtLimit(p.teamSizeLimit)} team members</li>
              <li>{fmtLimit(p.apiKeysLimit)} API keys</li>
            </ul>
            <button
              className={`btn ${sub?.plan === p.id ? '' : 'btn-primary'}`}
              disabled={sub?.plan === p.id}
              onClick={() => changePlan(p.id)}
            >
              {sub?.plan === p.id ? 'Current plan' : `Switch to ${p.name}`}
            </button>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Stripe integration is scaffolded but not yet wired. Plan changes are recorded immediately —
        the billing team will reconcile invoicing.
      </p>
    </div>
  );
}

function UsageStat({ label, value, limit }: { label: string; value: number; limit?: number }) {
  const pct = limit && limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toLocaleString()}</div>
      {limit !== undefined && limit > 0 && (
        <div className="stat-sub">
          {pct.toFixed(0)}% of {limit.toLocaleString()}
          <div style={{ height: 4, background: '#21262d', borderRadius: 2, marginTop: 4 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#da3633' : '#238636', borderRadius: 2 }} />
          </div>
        </div>
      )}
    </div>
  );
}

function fmtLimit(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return 'Unlimited';
  return n.toLocaleString();
}
