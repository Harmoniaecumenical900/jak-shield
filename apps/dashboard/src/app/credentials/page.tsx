'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Cred {
  id: string;
  name: string;
  connectorId?: string;
  createdAt: string;
  rotatedAt?: string;
}

export default function CredentialsPage() {
  const [creds, setCreds] = useState<Cred[]>([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setCreds(await api.get<Cred[]>('/api/credentials'));
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    try {
      await api.put(`/api/credentials/${encodeURIComponent(name)}`, { value });
      setOk(`Saved ${name}`);
      setName(''); setValue('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(name: string) {
    if (!confirm(`Delete credential ${name}?`)) return;
    await api.del(`/api/credentials/${encodeURIComponent(name)}`);
    await load();
  }

  return (
    <div>
      <h1>Credentials</h1>
      <p className="muted">
        Tenant-scoped, AES-256-GCM encrypted at rest (when <code>JAK_SHIELD_FIELD_KEY</code> is set).
        These are materialized into <code>process.env</code> per tool call and removed after.
      </p>

      <div className="card">
        <strong>Add or update a credential</strong>
        <form onSubmit={save} style={{ marginTop: 12 }}>
          {err && <div className="auth-error" style={{ marginBottom: 8 }}>{err}</div>}
          {ok && <div className="auth-error" style={{ background: '#143a1f', borderColor: '#1f5b2f', color: '#6ee7a3', marginBottom: 8 }}>{ok}</div>}
          <div className="form-row"><label>Env var name</label><input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="GITHUB_TOKEN" required /></div>
          <div className="form-row"><label>Value</label><input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="never shown again after save" required /></div>
          <button className="btn btn-primary">Save</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Stored credentials ({creds.length})</h2>
      <table>
        <thead><tr><th>Name</th><th>Created</th><th>Last rotated</th><th></th></tr></thead>
        <tbody>
          {creds.map((c) => (
            <tr key={c.id}>
              <td><code>{c.name}</code></td>
              <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              <td>{c.rotatedAt ? new Date(c.rotatedAt).toLocaleDateString() : '—'}</td>
              <td><button className="btn btn-danger" onClick={() => remove(c.name)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
