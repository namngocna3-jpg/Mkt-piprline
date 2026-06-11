"use client";
import React, { useEffect, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';
export type ToastItem = { id: string; kind: ToastKind; msg: string; ttl?: number };

type Listener = (items: ToastItem[]) => void;
const listeners = new Set<Listener>();
let items: ToastItem[] = [];

function emit() {
  for (const l of listeners) l(items);
}

export function showToast(kind: ToastKind, msg: string, ttl = 4000) {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  items = [...items, { id, kind, msg, ttl }];
  emit();
  if (ttl > 0) {
    setTimeout(() => {
      items = items.filter((it) => it.id !== id);
      emit();
    }, ttl);
  }
  return id;
}

export const toast = {
  success: (m: string, ttl?: number) => showToast('success', m, ttl),
  error: (m: string, ttl?: number) => showToast('error', m, ttl ?? 6000),
  info: (m: string, ttl?: number) => showToast('info', m, ttl),
  warn: (m: string, ttl?: number) => showToast('warn', m, ttl ?? 5000),
};

function dismiss(id: string) {
  items = items.filter((it) => it.id !== id);
  emit();
}

export function ToastContainer() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    const l: Listener = (next) => setList([...next]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (typeof window === 'undefined') return null;

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, left: 16, zIndex: 1000, display: 'flex', flexDirection: 'column-reverse', gap: 10, alignItems: 'flex-end', pointerEvents: 'none' }}>
      {list.map((t) => {
        const color =
          t.kind === 'success' ? { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#065f46' } :
          t.kind === 'error' ? { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#7f1d1d' } :
          t.kind === 'warn' ? { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#78350f' } :
          { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#1e3a8a' };
        const icon = t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : t.kind === 'warn' ? '⚠' : 'ℹ';
        return (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              minWidth: 0,
              maxWidth: 460,
              width: 'auto',
              pointerEvents: 'auto',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--color-canvas, #fff)',
              border: `1px solid ${color.border}`,
              borderLeft: `4px solid ${color.border}`,
              boxShadow: 'var(--shadow-elevated, 0 8px 24px rgba(0,0,0,0.12))',
              color: 'var(--color-ink, #0f172a)',
              cursor: 'pointer',
              animation: 'toast-in 220ms ease-out',
            }}
          >
            <span style={{ color: color.border, fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{icon}</span>
            <span style={{ fontSize: 14, lineHeight: 1.45, flex: 1, whiteSpace: 'pre-wrap' }}>{t.msg}</span>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              aria-label="Đóng"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-body-muted, #64748b)', padding: 0, fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
