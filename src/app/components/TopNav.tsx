"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Pipeline' },
  { href: '/chat', label: 'Twin Chat' },
  { href: '/posts', label: 'Thư viện' },
  { href: '/settings', label: 'Settings' },
];

export function TopNav() {
  const pathname = usePathname() || '/';
  // Hide top nav on the /chat route — chat has its own full-bleed shell
  if (pathname.startsWith('/chat')) return null;
  return (
    <header className="frosted" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52, gap: 28 }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, letterSpacing: '-0.022em', color: 'var(--color-ink)' }}>
          AI Content Pipeline
        </Link>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {LINKS.map(l => {
            const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  fontSize: 14,
                  padding: '7px 14px',
                  borderRadius: 9999,
                  color: active ? '#fff' : 'var(--color-ink)',
                  background: active ? 'var(--color-ink)' : 'transparent',
                  fontWeight: 500,
                  letterSpacing: '-0.224px',
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
