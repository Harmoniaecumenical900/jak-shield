'use client';

import { useEffect, useState } from 'react';

interface ApprovalRecord {
  id: string;
  toolName: string;
  reason: string;
  risk: string;
  status: string;
  requestedAt: string;
  decidedBy?: string;
  argsRedacted: Record<string, unknown>;
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/approvals?status=${statusFilter}`);
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const es = new EventSource('/api/stream/approvals');
    es.addEventListener('approval', () => load());
    return () => es.close();
  }, [statusFilter]);

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    await fetch(`/api/approvals/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, decidedBy: 'dashboard-user' }),
    });
    load();
  }

  return (
    <div>
      <h1>Approvals</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        {['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? 'btn-primary' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {loading && <div className="empty">Loading…</div>}
      {!loading && items.length === 0 && <div className="empty">No {statusFilter.toLowerCase()} approvals.</div>}
      {items.map((item) => (
        <div className="card" key={item.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{item.toolName}</strong>
              <span className={`badge badge-${item.risk.toLowerCase()}`} style={{ marginLeft: 8 }}>{item.risk}</span>
              <div className="muted" style={{ marginTop: 4 }}>{item.reason}</div>
            </div>
            {item.status === 'PENDING' && (
              <div>
                <button className="btn btn-primary" onClick={() => decide(item.id, 'APPROVED')}>Approve</button>
                <button className="btn btn-danger" onClick={() => decide(item.id, 'REJECTED')}>Reject</button>
              </div>
            )}
          </div>
          <details style={{ marginTop: 8 }}>
            <summary className="muted">Args (PII redacted)</summary>
            <pre>{JSON.stringify(item.argsRedacted, null, 2)}</pre>
          </details>
          <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
            id: {item.id} · requested: {new Date(item.requestedAt).toLocaleString()}
            {item.decidedBy && ` · decided by ${item.decidedBy}`}
          </div>
        </div>
      ))}
    </div>
  );
}
