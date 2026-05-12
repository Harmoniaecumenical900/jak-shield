'use client';

import { useEffect, useState } from 'react';

interface AuditEntry {
  id: string;
  action: string;
  severity: string;
  resource?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  useEffect(() => {
    const qs = new URLSearchParams();
    if (actionFilter) qs.set('action', actionFilter);
    if (severityFilter) qs.set('severity', severityFilter);
    fetch(`/api/audit?${qs}`).then((r) => r.json()).then(setItems);
  }, [actionFilter, severityFilter]);

  return (
    <div>
      <h1>Audit log</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          className="btn"
          placeholder="Filter by action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <select className="btn" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="">All severities</option>
          <option>INFO</option>
          <option>WARN</option>
          <option>ERROR</option>
          <option>CRITICAL</option>
        </select>
      </div>
      {items.length === 0 ? (
        <div className="empty">No matching audit entries.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Severity</th>
              <th>Resource</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{new Date(it.timestamp).toLocaleString()}</td>
                <td><code>{it.action}</code></td>
                <td>{it.severity}</td>
                <td>{it.resource ?? '—'}</td>
                <td><pre style={{ margin: 0 }}>{JSON.stringify(it.details)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
