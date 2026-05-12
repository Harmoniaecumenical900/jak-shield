'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useMe } from '@/lib/session';

const sections: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Operate',
    links: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/approvals', label: 'Approvals' },
      { href: '/audit', label: 'Audit log' },
      { href: '/audit-search', label: 'Audit search' },
      { href: '/blocked', label: 'Blocked' },
      { href: '/redactions', label: 'Redactions' },
    ],
  },
  {
    heading: 'Configure',
    links: [
      { href: '/connectors', label: 'Connectors' },
      { href: '/credentials', label: 'Credentials' },
      { href: '/policies', label: 'Policies' },
      { href: '/api-keys', label: 'API keys' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/team', label: 'Team' },
      { href: '/billing', label: 'Billing' },
    ],
  },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { me } = useMe();

  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      router.push('/login');
    }
  }

  return (
    <nav className="sidebar">
      {sections.map((section) => (
        <div key={section.heading} className="nav-section">
          <div className="nav-heading">{section.heading}</div>
          <ul>
            {section.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={path?.startsWith(l.href) ? 'active' : ''}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {me && (
        <div className="nav-user">
          <div className="muted" style={{ fontSize: 11 }}>signed in as</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{me.auth.email ?? me.auth.kind}</div>
          <div className="muted" style={{ fontSize: 11 }}>{me.auth.tenantId} Â· {me.auth.role}</div>
          <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={logout}>Sign out</button>
        </div>
      )}
    </nav>
  );
}
