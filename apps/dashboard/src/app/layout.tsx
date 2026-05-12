import type { ReactNode } from 'react';
import './globals.css';
import { Shell } from './shell';

export const metadata = {
  title: 'JAK Shield',
  description: 'Universal MCP security gateway',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
