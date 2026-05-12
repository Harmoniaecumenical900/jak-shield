'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Row {
  id: string;
  timestamp: string;
  action: string;
  severity: string;
  resource?: string;
  details: Record<string, unknown>;
}

export default function AuditSearchPage() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState('');
  const [resource, setResource] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (action) qs.set('action', action);
    if (severity) qs.set('severity', severity);
    if (resource) qs.set('resource', resource);
    if (since) qs.set('since', since);
    if (until) qs.set('until', until);
    qs.set('limit', '500');
    try {
      const res = await api.get<{ total: number; rows: Row[] }>(`/api/audit-search?${qs}`);
      setRows(res.rows);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  function csvHref(): string {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (action) qs.set('action', action);
    if (severity) qs.set('severity', severity);
    if (resource) qs.set('resource', resource);
    if (since) qs.set('since', since);
    if (until) qs.set('until', until);
    qs.set('format', 'csv');
    qs.set('limit', '5000');
    return `/api/audit-search?${qs.toString()}`;
  }

  return (
    <div>
      <h1>Audit search</h1>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="form-row"><label>Free text</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search resource + details" /></div>
          <div className="form-row"><label>Action</label><input value={action} onChange={(e) => setAction(e.target.value)} placeholder="POLICY_DECISION" /></div>
          <div className="form-row"><label>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">Any</option>
              <option>INFO</option><option>WARN</option><option>ERROR</option><option>CRITICAL</option>
            </select>
          </div>
          <div className="form-row"><label>Resource (tool name)</label><input value={resource} onChange={(e) => setResource(e.target.value)} placeholder="gmail.send_email" /></div>
          <div className="form-row"><label>Since</label><input type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} /></div>
          <div className="form-row"><label>Until</label><input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={search} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
          <a className="btn" href={csvHref()}>Download CSV</a>
          <span className="muted">{total ? `${total.toLocaleString()} matching entries` : ''}</span>
        </div>
      </div>

      {rows.length > 0 && (
        <table style={{ marginTop: 16 }}>
          <thead><tr><th>Time</th><th>Action</th><th>Severity</th><th>Resource</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.timestamp).toLocaleString()}</td>
                <td><code>{r.action}</code></td>
                <td><span className={`badge badge-${r.severity.toLowerCase()}`}>{r.severity}</span></td>
                <td>{r.resource ?? '—'}</td>
                <td><pre style={{ margin: 0, maxWidth: 500, overflow: 'auto' }}>{JSON.stringify(r.details)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
