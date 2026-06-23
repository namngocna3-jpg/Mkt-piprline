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
          <Link href="/" className="topnav-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span className="topnav-logo" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 7L12 3L20 7V17L12 21L4 17V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 11L12 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M4 7L12 11L20 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            AI Content Pipeline
          </Link>
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
