"use client";
import React, { useEffect, useState } from 'react';

type Health = {
  db: boolean | null;
  aiWrite: boolean;
  aiWriteProviders: string[];
  search: boolean;
  vision: boolean;
};

export function SetupBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('setupBannerDismissed') === '1') {
      setDismissed(true);
    }
    (async () => {
      try {
        const s = await fetch('/api/settings').then(r => r.json()).then(d => d?.settings || {}).catch(() => ({}));
        const aiProviders: string[] = [];
        if (s.GEMINI_API_KEY) aiProviders.push('Gemini');
        if (s.OPENAI_API_KEY) aiProviders.push('OpenAI');
        if (s.ANTHROPIC_API_KEY) aiProviders.push('Claude');
        if (s.TWINEXPERT_API_KEY) aiProviders.push('TwinExpert');
        const search = !!(s.BRAVE_API_KEY || s.TAVILY_API_KEY || s.SERPAPI_API_KEY || s.GOOGLE_CSE_KEY);
        const vision = !!(s.GEMINI_API_KEY || s.GROQ_API_KEY || s.OPENROUTER_API_KEY);
        let db: boolean | null = null;
        try { db = (await fetch('/api/db-test').then(r => r.json())).ok; } catch { db = null; }
        setHealth({ db, aiWrite: aiProviders.length > 0, aiWriteProviders: aiProviders, search, vision });
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (dismissed || checking || !health) return null;

  const allGood = health.db && health.aiWrite;
  // Nếu mọi thứ OK thì không cần banner
  if (allGood) return null;

  const Item = ({ ok, label, action }: { ok: boolean | null; label: string; action?: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ fontSize: 15 }}>{ok === null ? '⏳' : ok ? '✅' : '⚠️'}</span>
      <span style={{ color: ok ? 'var(--color-body-muted)' : 'var(--color-ink)', fontWeight: ok ? 400 : 500 }}>{label}</span>
      {!ok && action}
    </div>
  );

  return (
    <div style={{
      border: '1px solid var(--color-primary, #3b82f6)',
      background: 'var(--color-surface-pearl)',
      borderRadius: 12, padding: '16px 18px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>🚀 Thiết lập nhanh để bắt đầu</div>
        <button onClick={() => { localStorage.setItem('setupBannerDismissed', '1'); setDismissed(true); }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-body-muted)', fontSize: 18, lineHeight: 1 }}
          aria-label="Đóng">×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Item ok={health.db} label={health.db === null ? 'Đang kiểm tra database...' : health.db ? 'Database đã kết nối' : 'Database CHƯA kết nối'}
          action={<a href="/settings#sec-db" style={{ color: 'var(--color-primary)', fontSize: 12 }}>→ Test/cấu hình DB</a>} />
        <Item ok={health.aiWrite}
          label={health.aiWrite ? `AI viết: ${health.aiWriteProviders.join(', ')}` : 'CHƯA có AI key để viết bài'}
          action={<a href="/settings#sec-ai-vi-t-b-i" style={{ color: 'var(--color-primary)', fontSize: 12 }}>→ Lấy Gemini FREE (aistudio.google.com)</a>} />
      </div>
      {!health.aiWrite && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-body-muted)', lineHeight: 1.5 }}>
          💡 <b>Nhanh nhất:</b> lấy 1 key <b>Gemini 2.0 Flash MIỄN PHÍ</b> tại aistudio.google.com → dán vào /settings → chạy được toàn bộ (viết bài + tóm tắt + ảnh mô tả), không tốn xu nào.
        </div>
      )}
    </div>
  );
}
