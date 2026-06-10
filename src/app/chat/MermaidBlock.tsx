"use client";
import React, { useEffect, useRef, useState } from 'react';

let mermaidPromise: Promise<any> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m: any) => {
      const inst = m.default || m;
      try {
        inst.initialize({
          startOnLoad: false,
          theme: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'var(--font-text), system-ui, sans-serif',
        });
      } catch { /* already initialised */ }
      return inst;
    }).catch((e) => {
      mermaidPromise = null;
      throw e;
    });
  }
  return mermaidPromise;
}

let idCounter = 0;

export default function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>('');
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++idCounter}-${Date.now()}`;
    (async () => {
      try {
        const mermaid = await getMermaid();
        const trimmed = (code || '').trim();
        if (!trimmed) { if (!cancelled) setSvg(''); return; }
        const { svg } = await mermaid.render(id, trimmed);
        if (!cancelled) { setSvg(svg); setError(''); }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div style={{ background: 'var(--color-surface-pearl)', border: '1px solid var(--color-hairline)', borderRadius: 11, padding: 12, fontSize: 12 }}>
        <div style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: 6 }}>⚠ Mermaid render lỗi</div>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{error}</pre>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--color-body-muted)' }}>Xem source</summary>
          <pre style={{ margin: '6px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap' }}>{code}</pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-block"
      style={{ background: 'var(--color-surface-pearl)', borderRadius: 11, padding: 14, margin: '12px 0', overflowX: 'auto', textAlign: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg || '<div style="color:var(--color-body-muted);font-size:13px">Đang render diagram...</div>' }}
    />
  );
}
