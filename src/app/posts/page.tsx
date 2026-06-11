"use client";
import React, { useState, useEffect } from "react";
import { toast } from "../components/Toast";

const REFINE_CHIPS = [
  { id: 'regen', label: '🔄 Viết lại' }, { id: 'shorter', label: 'Ngắn hơn' },
  { id: 'longer', label: 'Dài hơn' }, { id: 'fun', label: 'Vui hơn' },
  { id: 'cta', label: 'Thêm CTA' }, { id: 'sharper', label: 'Bớt sáo rỗng' },
  { id: 'translate_en', label: '🌐 EN' },
];
const PLATFORM_CHIPS = [
  { id: 'facebook', label: 'Facebook' }, { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' }, { id: 'threads', label: 'Threads' }, { id: 'instagram', label: 'Instagram' },
  { id: 'video', label: '🎬 Video' },
];
const REFINE_PROVIDERS = [
  { id: 'gemini', label: '🔷 Gemini (free)' }, { id: 'claude', label: '🧠 Claude' },
  { id: 'openai', label: '🟢 OpenAI' }, { id: 'twinexpert', label: '🪞 Twin' },
];

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'draft' | 'copied'>('all');
  const [editing, setEditing] = useState<Record<string, { content: string; hashtags: string }>>({});
  const [copiedId, setCopiedId] = useState<string>('');
  const [refiningId, setRefiningId] = useState<string>('');
  const [refineProvider, setRefineProvider] = useState('gemini');

  useEffect(() => { reload(); }, []);

  const refinePost = async (p: any, opts: { presetId?: string; platformId?: string }) => {
    setRefiningId(p.id);
    try {
      const e = editing[p.id];
      const r = await fetch('/api/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, content: e?.content ?? p.content, hashtags: e?.hashtags ?? p.hashtags, provider: refineProvider, save: true, ...opts }),
      });
      const d = await r.json();
      if (r.ok && d.content) {
        setEditing(prev => { const n = { ...prev }; delete n[p.id]; return n; });
        await reload();
        toast.success(opts.platformId ? `✓ Đã tạo bản ${opts.platformId.toUpperCase()}` : '✓ Đã viết lại');
      } else {
        toast.error(`Viết lại lỗi: ${String(d?.error || '').slice(0, 200)}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err?.message || err}`);
    } finally {
      setRefiningId('');
    }
  };

  const reload = () => fetch('/api/posts').then(r => r.json()).then(d => setPosts(d.posts || [])).catch(e => console.log(e));

  const setEdit = (id: string, field: 'content' | 'hashtags', value: string) => {
    setEditing(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { content: '', hashtags: '' }), [field]: value },
    }));
  };

  const saveEdit = async (p: any) => {
    const e = editing[p.id];
    if (!e) return;
    await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, content: e.content ?? p.content, hashtags: e.hashtags ?? p.hashtags }),
    });
    setEditing(prev => { const n = { ...prev }; delete n[p.id]; return n; });
    reload();
  };

  const copy = async (p: any) => {
    const e = editing[p.id];
    const content = e?.content ?? p.content;
    const hashtags = e?.hashtags ?? p.hashtags;
    const fullText = `${content}\n\n${hashtags}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(''), 2000);
      // Mark as copied in DB (best-effort)
      await fetch('/api/posts/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, status: 'copied' }),
      }).catch(() => {});
      reload();
    } catch (err) {
      alert('Không copy được. Hãy bôi đen và copy thủ công.');
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url.startsWith('data:') ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const remove = async (id: string) => {
    if (!confirm('Xoá bài này vĩnh viễn?')) return;
    await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    reload();
  };

  const exportPosts = (fmt: 'md' | 'csv') => {
    const list = posts.filter(p => filter === 'all' ? true : p.status === filter);
    if (!list.length) { toast.warn('Không có bài để export.'); return; }
    let content = '', mime = '', ext = fmt;
    if (fmt === 'md') {
      content = list.map(p => `## ${p.article_title || 'Bài viết'}\n\n${p.content}\n\n${p.hashtags || ''}\n\n— nguồn: ${p.article_url || ''} · format: ${p.format || ''} · ${p.status}\n\n---\n`).join('\n');
      mime = 'text/markdown';
    } else {
      const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      content = 'title,content,hashtags,format,status,source_url\n' +
        list.map(p => [p.article_title, p.content, p.hashtags, p.format, p.status, p.article_url].map(esc).join(',')).join('\n');
      mime = 'text/csv';
    }
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `posts-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`✓ Đã export ${list.length} bài (.${ext})`);
  };

  const filtered = posts.filter(p => filter === 'all' ? true : p.status === filter);

  // Stats
  const total = posts.length;
  const copied = posts.filter(p => p.status === 'copied').length;
  const draft = posts.filter(p => p.status === 'draft').length;
  const today = posts.filter(p => p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 86400000).length;
  const formatCount: Record<string, number> = {};
  for (const p of posts) if (p.format) formatCount[p.format] = (formatCount[p.format] || 0) + 1;
  const topFormat = Object.entries(formatCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const copyRate = total ? Math.round((copied / total) * 100) : 0;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>📚 Thư viện bài đã viết</h1>
      <p style={{ color: 'var(--color-body-muted)', marginBottom: 20, fontSize: 14 }}>
        Bài đã được AI viết sẽ lưu ở đây. Click <b>Copy</b> để sao chép nội dung + hashtag, rồi paste tay lên trang cá nhân Facebook.
      </p>

      {/* Stats bar */}
      {total > 0 && (
        <div className="lib-stats">
          <div className="lib-stat">
            <div className="lib-stat-label">Tổng</div>
            <div className="lib-stat-value">{total}</div>
            <div className="lib-stat-pct">bài đã viết</div>
          </div>
          <div className="lib-stat">
            <div className="lib-stat-label">Đã copy</div>
            <div className="lib-stat-value">{copied}</div>
            <div className="lib-stat-pct">{copyRate}% tổng số</div>
          </div>
          <div className="lib-stat">
            <div className="lib-stat-label">Chưa copy</div>
            <div className="lib-stat-value">{draft}</div>
            <div className="lib-stat-pct">đang chờ đăng</div>
          </div>
          <div className="lib-stat">
            <div className="lib-stat-label">Hôm nay</div>
            <div className="lib-stat-value">{today}</div>
            <div className="lib-stat-pct">bài mới 24h</div>
          </div>
          <div className="lib-stat">
            <div className="lib-stat-label">Format hot</div>
            <div className="lib-stat-value" style={{ fontSize: 16, textTransform: 'uppercase' }}>{topFormat}</div>
            <div className="lib-stat-pct">{formatCount[topFormat] || 0} bài</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setFilter('all')} className={`tag ${filter === 'all' ? 'active' : ''}`}>Tất cả ({posts.length})</button>
        <button onClick={() => setFilter('draft')} className={`tag ${filter === 'draft' ? 'active' : ''}`}>📝 Chưa copy ({draft})</button>
        <button onClick={() => setFilter('copied')} className={`tag ${filter === 'copied' ? 'active' : ''}`}>✅ Đã copy ({copied})</button>
        {posts.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="tag" onClick={() => exportPosts('md')}>📦 Export .md</button>
            <button className="tag" onClick={() => exportPosts('csv')}>📊 Export .csv</button>
          </div>
        )}
      </div>

      {filtered.map(p => {
        const e = editing[p.id];
        const content = e?.content ?? p.content;
        const hashtags = e?.hashtags ?? p.hashtags;
        const isDirty = !!e;
        return (
          <div key={p.id} className="card" style={{ padding: 20, marginBottom: 16, display: 'flex', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${p.format === 'pov' ? 'badge-amber' : 'badge-cyan'}`}>{p.format?.toUpperCase()}</span>
                {p.ai_provider && <span className="badge">🤖 {p.ai_provider}</span>}
                {p.status === 'copied' && <span className="badge badge-success">✅ Đã copy</span>}
                <a href={p.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--color-primary)', marginLeft: 'auto' }}>🔗 Bài gốc</a>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-body-muted)', marginBottom: 8 }}>Nguồn: {p.article_title}</div>
              <textarea
                className="input-field"
                value={content}
                onChange={ev => setEdit(p.id, 'content', ev.target.value)}
                style={{ minHeight: 140, marginBottom: 10, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
              />
              <input
                className="input-field"
                value={hashtags}
                onChange={ev => setEdit(p.id, 'hashtags', ev.target.value)}
                style={{ marginBottom: 12, fontSize: 13 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => copy(p)} style={copiedId === p.id ? { background: 'var(--color-success)' } : undefined}>
                  {copiedId === p.id ? '✅ Đã copy!' : '📋 Copy bài + hashtag'}
                </button>
                {isDirty && (
                  <button className="btn-warn" onClick={() => saveEdit(p)}>💾 Lưu sửa</button>
                )}
                <button className="btn-danger" onClick={() => remove(p.id)}>🗑 Xoá
                </button>
              </div>

              {/* Viết lại / Biến thể nền tảng */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-divider-soft)' }}>
                {refiningId === p.id ? (
                  <div style={{ fontSize: 13, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" /> Đang viết lại...
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-body-muted)', fontWeight: 600 }}>✍️ Viết lại:</span>
                      {REFINE_CHIPS.map(c => <button key={c.id} className="tag" style={{ fontSize: 12 }} onClick={() => refinePost(p, { presetId: c.id })}>{c.label}</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-body-muted)', fontWeight: 600 }}>📱 Đổi nền tảng:</span>
                      {PLATFORM_CHIPS.map(c => <button key={c.id} className="tag" style={{ fontSize: 12 }} onClick={() => refinePost(p, { platformId: c.id })}>{c.label}</button>)}
                      <select value={refineProvider} onChange={e => setRefineProvider(e.target.value)} className="input-field" style={{ width: 'auto', padding: '4px 8px', fontSize: 12, marginLeft: 'auto' }}>
                        {REFINE_PROVIDERS.map(p2 => <option key={p2.id} value={p2.id}>{p2.label}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mobile-img-col" style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.generated_image_url && (
                <div>
                  <a href={p.generated_image_url} target="_blank" rel="noreferrer">
                    <img src={p.generated_image_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 4, cursor: 'zoom-in' }} />
                  </a>
                  <button onClick={() => downloadImage(p.generated_image_url, `ai-${p.id}.jpg`)} className="tag" style={{ fontSize: 11, width: '100%', justifyContent: 'center' }}>⬇️ Ảnh AI</button>
                </div>
              )}
              {p.original_image_url && (
                <div>
                  <a href={p.original_image_url} target="_blank" rel="noreferrer">
                    <img
                      src={p.original_image_url.startsWith('data:') ? p.original_image_url : `/api/image-proxy?url=${encodeURIComponent(p.original_image_url)}`}
                      style={{ width: '100%', minHeight: 140, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 4, cursor: 'zoom-in' }}
                      onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </a>
                  <button onClick={() => downloadImage(p.original_image_url, `original-${p.id}.jpg`)} className="tag" style={{ fontSize: 11, width: '100%', justifyContent: 'center' }}>⬇️ Ảnh gốc</button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Chưa có bài viết nào</div>
          <p style={{ color: 'var(--color-body-muted)', marginBottom: 20, fontSize: 14 }}>
            Vào Dashboard → Auto-Scan nguồn → Chọn bài & AI viết để tạo content.
          </p>
          <a href="/" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none', padding: '10px 18px' }}>
            → Đi tới Pipeline
          </a>
        </div>
      )}
    </div>
  );
}
