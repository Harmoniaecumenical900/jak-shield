'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api.post('/api/auth/invitations/accept', { token, password, name });
      router.push('/login?invited=1');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Join workspace</h1>
      <span className="muted">Set a password to accept the invite.</span>
      <form onSubmit={submit}>
        {err && <div className="auth-error">{err}</div>}
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Joining…' : 'Accept invite'}
        </button>
      </form>
    </div>
  );
}
