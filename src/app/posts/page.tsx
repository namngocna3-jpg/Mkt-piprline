"use client";
import React, { useState, useEffect } from "react";
import { toast } from "../components/Toast";

const REFINE_CHIPS = [
  { id: 'regen', label: '🔄 Viết lại' }, { id: 'shorter', label: 'Ngắn hơn' },
  { id: 'longer', label: 'Dài hơn' }, { id: 'fun', label: 'Vui hơn' },
  { id: 'cta', label: 'Thêm CTA' }, { id: 'sharper', label: 'Bớt sáo rỗng' },
];
const PLATFORM_CHIPS = [
  { id: 'facebook', label: 'Facebook' }, { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' }, { id: 'threads', label: 'Threads' }, { id: 'instagram', label: 'Instagram' },
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} className={`tag ${filter === 'all' ? 'active' : ''}`}>Tất cả ({posts.length})</button>
        <button onClick={() => setFilter('draft')} className={`tag ${filter === 'draft' ? 'active' : ''}`}>📝 Chưa copy ({draft})</button>
        <button onClick={() => setFilter('copied')} className={`tag ${filter === 'copied' ? 'active' : ''}`}>✅ Đã copy ({copied})</button>
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
                <span style={{ fontSize: 11, padding: '3px 8px', background: p.format === 'pov' ? '#fef3c7' : '#e0f2fe', color: p.format === 'pov' ? '#d97706' : '#0284c7', borderRadius: 4, fontWeight: 600 }}>
                  {p.format?.toUpperCase()}
                </span>
                {p.ai_provider && (
                  <span style={{ fontSize: 11, padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 4, fontWeight: 600 }}>
                    🤖 {p.ai_provider}
                  </span>
                )}
                {p.status === 'copied' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✅ Đã copy</span>}
                <a href={p.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', marginLeft: 'auto' }}>🔗 Bài gốc</a>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Nguồn: {p.article_title}</div>
              <textarea
                value={content}
                onChange={ev => setEdit(p.id, 'content', ev.target.value)}
                style={{ width: '100%', minHeight: 140, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 10, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <input
                value={hashtags}
                onChange={ev => setEdit(p.id, 'hashtags', ev.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, marginBottom: 12, outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => copy(p)} style={{ padding: '10px 20px', background: copiedId === p.id ? '#10b981' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  {copiedId === p.id ? '✅ Đã copy!' : '📋 Copy bài + hashtag'}
                </button>
                {isDirty && (
                  <button onClick={() => saveEdit(p)} style={{ padding: '10px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    💾 Lưu sửa
                  </button>
                )}
                <button onClick={() => remove(p.id)} style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  🗑 Xoá
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
            <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.original_image_url && (
                <div>
                  <img
                    src={p.original_image_url.startsWith('data:') ? p.original_image_url : `/api/image-proxy?url=${encodeURIComponent(p.original_image_url)}`}
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, display: 'block', marginBottom: 4 }}
                  />
                  <button onClick={() => downloadImage(p.original_image_url, `original-${p.id}.jpg`)} style={{ fontSize: 11, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', width: '100%' }}>
                    ⬇️ Tải ảnh gốc
                  </button>
                </div>
              )}
              {p.generated_image_url && (
                <div>
                  <img src={p.generated_image_url} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, display: 'block', marginBottom: 4 }} />
                  <button onClick={() => downloadImage(p.generated_image_url, `ai-${p.id}.jpg`)} style={{ fontSize: 11, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', width: '100%' }}>
                    ⬇️ Tải ảnh AI
                  </button>
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
