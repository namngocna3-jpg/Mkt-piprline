"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Pipeline' },
  { href: '/chat', label: 'Twin Chat' },
  { href: '/posts', label: 'Thư viện' },
  { href: '/settings', label: 'Settings' },
];

export function TopNav() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  if (pathname.startsWith('/chat')) return null;

  return (
    <>
      <header className="frosted topnav" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="topnav-inner">
          <Link href="/" className="topnav-brand">AI Content Pipeline</Link>
          <nav className="topnav-links">
            {LINKS.map(l => {
              const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
              return (
                <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`topnav-link${active ? ' active' : ''}`}>{l.label}</Link>
              );
            })}
          </nav>
          <button
            className="topnav-burger"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setOpen(o => !o)}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
        {open && (
          <nav className="topnav-mobile-menu">
            {LINKS.map(l => {
              const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={`topnav-link${active ? ' active' : ''}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
    </>
  );
}
