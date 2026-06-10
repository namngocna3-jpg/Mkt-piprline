import React from 'react';
import './globals.css';
import { TopNav } from './components/TopNav';
import { ToastContainer } from './components/Toast';

export const metadata = {
  title: 'AI Content Pipeline',
  description: 'Twin Chat + content automation, Apple design',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <TopNav />
        <main style={{ padding: '48px 32px 64px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
