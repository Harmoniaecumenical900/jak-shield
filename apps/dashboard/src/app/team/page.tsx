'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; email: string; name?: string; lastLoginAt?: string };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

const ROLES = ['EXTERNAL_AUDITOR', 'END_USER', 'REVIEWER', 'OPERATOR', 'TENANT_ADMIN'];

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('END_USER');
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setMembers(await api.get<Member[]>('/api/teams/members'));
    setInvites(await api.get<Invitation[]>('/api/auth/invitations'));
  }

  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setAcceptUrl(null);
    try {
      const result = await api.post<{ acceptUrl: string }>('/api/auth/invitations', { email, role });
      setAcceptUrl(result.acceptUrl);
      setEmail('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function changeRole(userId: string, newRole: string) {
    await api.put(`/api/teams/members/${userId}/role`, { role: newRole });
    await load();
  }

  async function remove(userId: string) {
    if (!confirm('Remove this member?')) return;
    await api.del(`/api/teams/members/${userId}`);
    await load();
  }

  async function revokeInvite(id: string) {
    await api.del(`/api/auth/invitations/${id}`);
    await load();
  }

  return (
    <div>
      <h1>Team</h1>
      {err && <div className="auth-error">{err}</div>}

      <div className="card">
        <strong>Invite a teammate</strong>
        <form onSubmit={invite} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required style={{ flex: 1 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button className="btn btn-primary">Send invite</button>
        </form>
        {acceptUrl && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Share this URL — invites are not emailed yet:</div>
            <div className="copy">{acceptUrl}</div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Members ({members.length})</h2>
      <table>
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Joined</th><th>Last login</th><th></th></tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user.email}</td>
              <td>{m.user.name ?? '—'}</td>
              <td>
                <select defaultValue={m.role} onChange={(e) => changeRole(m.user.id, e.target.value)}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
              <td>{m.user.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleString() : '—'}</td>
              <td><button className="btn btn-danger" onClick={() => remove(m.user.id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {invites.filter((i) => !i.acceptedAt).length > 0 && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24 }}>Pending invitations</h2>
          <table>
            <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {invites.filter((i) => !i.acceptedAt).map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>{i.role}</td>
                  <td>{new Date(i.expiresAt).toLocaleString()}</td>
                  <td><button className="btn btn-danger" onClick={() => revokeInvite(i.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
