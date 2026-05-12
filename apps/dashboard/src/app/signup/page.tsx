'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api.post('/api/auth/signup', { email, password, tenantName, name });
      router.push('/dashboard');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Create a JAK Shield workspace</h1>
      <span className="muted">Free plan — no credit card.</span>
      <form onSubmit={submit}>
        {err && <div className="auth-error">{err}</div>}
        <input placeholder="Workspace name (e.g. Acme Inc)" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
      <div className="footer-link">
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}
