'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Nav } from './nav';

const AUTH_PATHS = ['/login', '/signup', '/invite'];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  const isAuthPage = AUTH_PATHS.some((p) => path.startsWith(p));

  if (isAuthPage) {
    return <main className="auth-shell">{children}</main>;
  }
  return (
    <div className="layout">
      <header className="topbar">
        <strong>JAK Shield</strong>
        <span className="muted">universal MCP security gateway</span>
      </header>
      <div className="content">
        <Nav />
        <main>{children}</main>
      </div>
    </div>
  );
}
