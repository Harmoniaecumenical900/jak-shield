'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

interface Created extends ApiKey { key: string }

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>(['mcp:invoke']);
  const [created, setCreated] = useState<Created | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setKeys(await api.get<ApiKey[]>('/api/api-keys'));
    setScopes(await api.get<string[]>('/api/api-keys/scopes'));
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreated(null);
    try {
      const result = await api.post<Created>('/api/api-keys', { name, scopes: chosen });
      setCreated(result);
      setName('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this API key? Existing requests using it will start failing immediately.')) return;
    await api.del(`/api/api-keys/${id}`);
    await load();
  }

  function toggleScope(s: string) {
    setChosen((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  return (
    <div>
      <h1>API keys</h1>
      <p className="muted">Use these to authenticate to the hosted MCP gateway and the REST API.</p>

      <div className="card">
        <strong>Create new key</strong>
        <form onSubmit={create} style={{ marginTop: 12 }}>
          {err && <div className="auth-error" style={{ marginBottom: 8 }}>{err}</div>}
          <div className="form-row">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cursor on my laptop" required />
          </div>
          <div className="form-row">
            <label>Scopes</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {scopes.map((s) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input type="checkbox" checked={chosen.includes(s)} onChange={() => toggleScope(s)} />
                  <code>{s}</code>
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary">Create</button>
        </form>
        {created && (
          <div style={{ marginTop: 12 }}>
            <div className="auth-error" style={{ background: '#3a2c0c', borderColor: '#5a4a10', color: '#ffd56b' }}>
              Copy this key now — it will not be shown again.
            </div>
            <div className="copy" style={{ marginTop: 8 }}>{created.key}</div>
            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              Use as: <code>Authorization: Bearer {created.key.slice(0, 16)}…</code> against{' '}
              <code>POST /mcp/&lt;tenantId&gt;</code>
            </div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Existing keys ({keys.length})</h2>
      <table>
        <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Created</th><th>Last used</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.name}</td>
              <td><code>{k.keyPrefix}…</code></td>
              <td>{k.scopes.map((s) => <code key={s} style={{ marginRight: 4 }}>{s}</code>)}</td>
              <td>{new Date(k.createdAt).toLocaleDateString()}</td>
              <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}</td>
              <td>
                {k.revokedAt
                  ? <span className="pill pill-error">revoked</span>
                  : <span className="pill pill-ok">active</span>}
              </td>
              <td>{!k.revokedAt && <button className="btn btn-danger" onClick={() => revoke(k.id)}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
