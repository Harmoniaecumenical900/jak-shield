'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Summary {
  range: string;
  totals: {
    decisions: number;
    blocked: number;
    approvalsCreated: number;
    approvalsApproved: number;
    redactions: number;
    injections: number;
    classifierCalls: number;
  };
  ratios: { blockRate: number; approvalRate: number };
}

interface Bucket {
  bucket: string;
  decisions: number;
  blocked: number;
  approvals: number;
  redactions: number;
}

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<Bucket[]>([]);
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    api.get<Summary>(`/api/analytics/summary?range=${range}`).then(setSummary).catch(() => {});
    api.get<Bucket[]>(`/api/analytics/timeline?range=${range}`).then(setTimeline).catch(() => {});
  }, [range]);

  const max = Math.max(1, ...timeline.map((b) => b.decisions));

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Overview</h1>
        <div className="row">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button key={r} className={`btn ${range === r ? 'btn-primary' : ''}`} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Decisions" value={summary?.totals.decisions ?? 0} />
        <Stat label="Blocked" value={summary?.totals.blocked ?? 0} sub={`${pct(summary?.ratios.blockRate)} of decisions`} />
        <Stat label="Approvals queued" value={summary?.totals.approvalsCreated ?? 0} sub={`${summary?.totals.approvalsApproved ?? 0} approved`} />
        <Stat label="Redactions" value={summary?.totals.redactions ?? 0} />
        <Stat label="Injection attempts" value={summary?.totals.injections ?? 0} />
        <Stat label="Classifier calls" value={summary?.totals.classifierCalls ?? 0} />
      </div>

      <div className="card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Decisions over {range}</div>
        <div className="bars">
          {timeline.map((b) => (
            <div key={b.bucket} className="bar" title={`${new Date(b.bucket).toLocaleString()} · ${b.decisions} decisions`}
                 style={{ height: `${(b.decisions / max) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Blocked over {range}</div>
        <div className="bars">
          {timeline.map((b) => (
            <div key={b.bucket} className="bar danger" title={`${new Date(b.bucket).toLocaleString()} · ${b.blocked} blocked`}
                 style={{ height: `${(b.blocked / max) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Approvals queued over {range}</div>
        <div className="bars">
          {timeline.map((b) => (
            <div key={b.bucket} className="bar warn" title={`${new Date(b.bucket).toLocaleString()} · ${b.approvals} approvals`}
                 style={{ height: `${(b.approvals / max) * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toLocaleString()}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function pct(r?: number): string {
  if (r == null) return '—';
  return `${(r * 100).toFixed(1)}%`;
}
