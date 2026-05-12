'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Requirement {
  connector: string;
  displayName: string;
  description: string;
  required: { name: string; description: string; sensitive: boolean }[];
  optional?: { name: string; description: string; sensitive: boolean }[];
  configured: boolean;
  missing: string[];
  docsUrl?: string;
}

export default function ConnectorsPage() {
  const [items, setItems] = useState<Requirement[]>([]);
  useEffect(() => { api.get<Requirement[]>('/api/connectors').then(setItems).catch(() => {}); }, []);

  return (
    <div>
      <h1>Connectors</h1>
      <p className="muted">
        Each connector below is gated by JAK Shield. Add the listed credentials on the
        <Link href="/credentials" style={{ marginLeft: 4 }}>Credentials</Link> page to enable it for this tenant.
      </p>
      {items.map((r) => (
        <div className="card" key={r.connector}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{r.displayName}</strong>{' '}
              <code style={{ marginLeft: 6 }}>{r.connector}</code>{' '}
              {r.configured
                ? <span className="pill pill-ok" style={{ marginLeft: 8 }}>configured</span>
                : <span className="pill pill-warn" style={{ marginLeft: 8 }}>missing {r.missing.length} cred{r.missing.length === 1 ? '' : 's'}</span>}
            </div>
            {r.docsUrl && <a href={r.docsUrl} target="_blank" rel="noreferrer" className="btn">Docs</a>}
          </div>
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{r.description}</div>
          {r.required.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Required environment</div>
              <ul style={{ marginTop: 6 }}>
                {r.required.map((v) => (
                  <li key={v.name} style={{ fontSize: 13 }}>
                    <code>{v.name}</code>
                    {' — '}{v.description}{' '}
                    {!r.missing.includes(v.name)
                      ? <span className="pill pill-ok" style={{ marginLeft: 6 }}>set</span>
                      : <span className="pill pill-error" style={{ marginLeft: 6 }}>missing</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.optional && r.optional.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ fontSize: 12 }}>Optional</div>
              <ul style={{ marginTop: 6 }}>
                {r.optional.map((v) => (
                  <li key={v.name} style={{ fontSize: 13 }}><code>{v.name}</code>{' — '}{v.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
