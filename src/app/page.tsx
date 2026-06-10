"use client";
import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'claude', label: '🧠 Claude (Anthropic)' },
  { id: 'openai', label: '🟢 OpenAI (GPT)' },
  { id: 'gemini', label: '🔷 Google Gemini' },
  { id: 'twinexpert', label: '🪞 TwinExpert' },
] as const;

export default function PipelinePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [provider, setProvider] = useState<string>('claude');

  const [articles, setArticles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState<Record<string, string>>({});

  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editedHashtags, setEditedHashtags] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string>('');

  useEffect(() => {
    if (step === 2) fetchArticles();
    if (step === 3) fetchPosts();
  }, [step]);

  const fetchArticles = async () => {
    const res = await fetch(`/api/articles?filter=${sourceFilter}`);
    const data = await res.json();
    setArticles(data.articles || []);
  };

  const fetchPosts = async () => {
    const res = await fetch('/api/posts');
    const data = await res.json();
    setPosts(data.posts || []);
  };

  const handleResearch = async () => {
    setLoading(true);
    await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFilter })
    });
    setLoading(false);
    setStep(2);
  };

  const setArticleSelection = (id: string, format: string) => {
    const next = new Set(selectedArticles);
    next.add(id);
    setSelectedArticles(next);
    setSelectedFormat({ ...selectedFormat, [id]: format });
  };

  const toggleArticleSelection = (id: string) => {
    const next = new Set(selectedArticles);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (!selectedFormat[id]) setSelectedFormat({ ...selectedFormat, [id]: 'pov' });
    }
    setSelectedArticles(next);
  };

  const handleBatchWrite = async () => {
    if (selectedArticles.size === 0) return alert('Vui lòng chọn ít nhất 1 bài để viết!');
    for (const id of selectedArticles) {
      if (!selectedFormat[id]) return alert('Vui lòng chọn format cho tất cả bài đã tick!');
    }

    setLoading(true);
    const selections = Array.from(selectedArticles).map(id => ({ id, format: selectedFormat[id] }));
    try {
      const res = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, provider }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.success) {
        alert(`Đã viết xong ${data.count} bài bằng ${provider.toUpperCase()}!`);
        setSelectedArticles(new Set());
        setStep(3);
      } else {
        alert('CẢNH BÁO LỖI TỪ AI:\n' + (data.error || 'Lỗi không xác định'));
      }
    } catch (e: any) {
      setLoading(false);
      alert('Lỗi kết nối mạng: ' + e.message);
    }
  };

  const copyPost = async (p: any) => {
    const content = editedContent[p.id] ?? p.content;
    const hashtags = editedHashtags[p.id] ?? p.hashtags;
    const fullText = `${content}\n\n${hashtags}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(''), 2000);
      await fetch('/api/posts/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, status: 'copied' }),
      }).catch(() => {});
      fetchPosts();
    } catch (err) {
      alert('Không copy được. Hãy bôi đen và copy thủ công.');
    }
  };

  const saveEdits = async (p: any) => {
    await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        content: editedContent[p.id] ?? p.content,
        hashtags: editedHashtags[p.id] ?? p.hashtags,
      }),
    });
    fetchPosts();
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

  const deletePost = async (id: string) => {
    if (!confirm('Xoá bài này vĩnh viễn?')) return;
    await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    fetchPosts();
  };

  return (
    <>
      <div className="stepper">
        <div className={`step ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)} style={{ cursor: 'pointer' }}>1 Research</div>
        <div className="step-divider">→</div>
        <div className={`step ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)} style={{ cursor: 'pointer' }}>2 Chọn bài & AI viết</div>
        <div className="step-divider">→</div>
        <div className={`step ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)} style={{ cursor: 'pointer' }}>3 Copy & Đăng thủ công</div>
      </div>

      {step === 1 && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Chọn nguồn cào tin</label>
            <div className="source-tags">
              <button className={`tag ${sourceFilter === 'all' ? 'active' : ''}`} onClick={() => setSourceFilter('all')}>
                <span className="tag-icon">🌐</span> Tất cả
              </button>
              <button className={`tag ${sourceFilter === 'news' ? 'active' : ''}`} onClick={() => setSourceFilter('news')}>
                <span className="tag-icon">📰</span> Báo Công nghệ
              </button>
              <button className={`tag ${sourceFilter === 'x' ? 'active' : ''}`} onClick={() => setSourceFilter('x')}>
                <span className="tag-icon">𝕏</span> X (Twitter)
              </button>
              <button className={`tag ${sourceFilter === 'instagram' ? 'active' : ''}`} onClick={() => setSourceFilter('instagram')}>
                <span className="tag-icon">📸</span> Instagram
              </button>
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>Hệ thống sẽ quét báo lớn (TechCrunch, a16z...) và mạng xã hội để bóc tách tin mới nhất (trong 24h).</p>
          </div>
          <button className="btn-primary" onClick={handleResearch} disabled={loading}>
            {loading ? 'Đang cào dữ liệu...' : '⚡ Bắt đầu Auto-Scan'}
          </button>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <label className="form-label" style={{ fontSize: 13 }}>Chọn AI viết bài</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PROVIDERS.map(pv => (
                <button key={pv.id} type="button" className={`tag ${provider === pv.id ? 'active' : ''}`} onClick={() => setProvider(pv.id)}>
                  {pv.label}
                </button>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
              Cần thêm API key? Vào <a href="/settings" style={{ color: '#2563eb' }}>⚙️ Settings</a>.
            </p>
          </div>

          <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, color: '#1e293b' }}>Tin mới chờ xử lý ({articles.filter(a => a.status === 'new').length})</h3>
            <button
              className="btn-primary mobile-full-btn"
              style={{ background: '#2563eb' }}
              onClick={handleBatchWrite}
              disabled={loading || selectedArticles.size === 0}
            >
              {loading ? 'Đang viết & tạo ảnh...' : `🤖 ${PROVIDERS.find(p => p.id === provider)?.label.split(' ')[1] || provider} viết (${selectedArticles.size} bài)`}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {articles.filter(a => a.status === 'new').map(a => (
              <div key={a.id} className="card mobile-col" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleArticleSelection(a.id)}>
                <input type="checkbox" style={{ width: 18, height: 18, marginTop: 4, cursor: 'pointer' }} checked={selectedArticles.has(a.id)} readOnly />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, color: '#64748b' }}>{a.source_name}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(a.published_at).toLocaleString('vi-VN')}</span>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', marginLeft: 'auto' }}>🔗 Mở link bài gốc</a>
                  </div>
                  <h4 style={{ marginBottom: 8, fontSize: 16, color: '#0f172a' }}>{a.title}</h4>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>{a.summary}</p>
                  <div className="mobile-wrap" style={{ display: 'flex', gap: 12 }} onClick={e => e.stopPropagation()}>
                    <button className={`tag ${selectedFormat[a.id] === 'pov' ? 'active' : ''}`} onClick={() => setArticleSelection(a.id, 'pov')}>📝 Style: Góc nhìn (POV)</button>
                    <button className={`tag ${selectedFormat[a.id] === 'info' ? 'active' : ''}`} onClick={() => setArticleSelection(a.id, 'info')}>📊 Style: Tin tức (Info)</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, color: '#1e293b' }}>Bài chờ copy ({posts.filter(p => p.status === 'draft').length})</h3>
            <p style={{ fontSize: 13, color: '#64748b' }}>Click <b>Copy</b> → mở Facebook → paste là xong.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.filter(p => p.status === 'draft' || p.status === 'copied').map(p => (
              <div key={p.id} className="card mobile-col" style={{ padding: 24, display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '4px 8px', background: p.format === 'pov' ? '#fef3c7' : '#e0f2fe', color: p.format === 'pov' ? '#d97706' : '#0284c7', borderRadius: 4, fontWeight: 600 }}>
                      {p.format?.toUpperCase()}
                    </span>
                    {p.ai_provider && (
                      <span style={{ fontSize: 11, padding: '4px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 4, fontWeight: 600 }}>
                        🤖 {p.ai_provider}
                      </span>
                    )}
                    {p.status === 'copied' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✅ Đã copy</span>}
                    <a href={p.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', marginLeft: 'auto' }}>🔗 Đọc bài gốc</a>
                  </div>
                  <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#64748b' }}>Nguồn: {p.article_title}</div>
                  <textarea
                    style={{ width: '100%', minHeight: 140, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 10, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    value={editedContent[p.id] ?? p.content}
                    onChange={e => setEditedContent({ ...editedContent, [p.id]: e.target.value })}
                  />
                  <input
                    style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, marginBottom: 12, outline: 'none' }}
                    value={editedHashtags[p.id] ?? p.hashtags}
                    onChange={e => setEditedHashtags({ ...editedHashtags, [p.id]: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => copyPost(p)} style={{ padding: '10px 20px', background: copiedId === p.id ? '#10b981' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                      {copiedId === p.id ? '✅ Đã copy!' : '📋 Copy bài + hashtag'}
                    </button>
                    {(editedContent[p.id] !== undefined || editedHashtags[p.id] !== undefined) && (
                      <button onClick={() => saveEdits(p)} style={{ padding: '10px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                        💾 Lưu sửa
                      </button>
                    )}
                    <button onClick={() => deletePost(p.id)} style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                      🗑 Xoá
                    </button>
                  </div>
                </div>
                <div className="mobile-img-col" style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {p.original_image_url && (
                    <div>
                      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
                        <span style={{ position: 'absolute', top: 4, left: 4, zIndex: 10, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Ảnh báo gốc</span>
                        <img
                          src={p.original_image_url.startsWith('data:') ? p.original_image_url : `/api/image-proxy?url=${encodeURIComponent(p.original_image_url)}`}
                          style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <button onClick={() => downloadImage(p.original_image_url, `original-${p.id}.jpg`)} style={{ fontSize: 11, padding: '6px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', width: '100%', marginTop: 4 }}>
                        ⬇️ Tải ảnh gốc
                      </button>
                    </div>
                  )}
                  {p.generated_image_url && (
                    <div>
                      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
                        <span style={{ position: 'absolute', top: 4, left: 4, zIndex: 10, background: 'rgba(37,99,235,0.8)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>AI tạo</span>
                        <img src={p.generated_image_url} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      </div>
                      <button onClick={() => downloadImage(p.generated_image_url, `ai-${p.id}.jpg`)} style={{ fontSize: 11, padding: '6px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', width: '100%', marginTop: 4 }}>
                        ⬇️ Tải ảnh AI
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
