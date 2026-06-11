"use client";
import React, { useState, useEffect } from 'react';
import { toast } from './components/Toast';
import { findModel, estCostPerPost, formatCost } from '@/lib/ai/models';
import { cleanText } from '@/lib/textClean';

type SourceStatus = 'free' | 'optional' | 'required';
type SourceDef = {
  id: string;
  icon: string;
  label: string;
  status: SourceStatus;
  needs?: string[];
  hint: string;
  group: 'content' | 'social';
};

// Nhóm "content" = nội dung đầy đủ, viết bài chất lượng. "social" = mỏng/cập nhật xu hướng.
// Đã BỎ Pinterest + Threads (nội dung rỗng, không viết bài được).
const SOURCES: SourceDef[] = [
  // === Nội dung tốt (ưu tiên) ===
  { id: 'news', icon: '📰', label: 'Báo Công nghệ', status: 'free', group: 'content', hint: 'RSS TechCrunch, a16z...' },
  { id: 'hackernews', icon: '🟧', label: 'Hacker News', status: 'free', group: 'content', hint: 'Tin công nghệ hot, có ngày thật' },
  { id: 'reddit', icon: '🤖', label: 'Reddit', status: 'free', group: 'content', hint: '9 subreddits AI' },
  { id: 'devto', icon: '💻', label: 'Dev.to', status: 'free', group: 'content', hint: 'Bài viết kỹ thuật đầy đủ' },
  { id: 'medium', icon: '📝', label: 'Medium', status: 'free', group: 'content', hint: 'Bài blog theo tag' },
  { id: 'github', icon: '⭐', label: 'GitHub Trending', status: 'free', group: 'content', hint: 'Repo AI trending' },
  { id: 'producthunt', icon: '🚀', label: 'Product Hunt', status: 'free', group: 'content', hint: 'Sản phẩm AI mới' },
  { id: 'arxiv', icon: '📄', label: 'arXiv', status: 'free', group: 'content', hint: 'Paper AI (học thuật)' },
  { id: 'lobsters', icon: '🦞', label: 'Lobsters', status: 'free', group: 'content', hint: 'Tin công nghệ chọn lọc' },
  // === Social / Xu hướng (mỏng hơn) ===
  { id: 'x', icon: '𝕏', label: 'X (Twitter)', status: 'required', needs: ['RAPID_API_KEY'], group: 'social', hint: 'Cần RapidAPI (Twitter API47)' },
  { id: 'linkedin', icon: '💼', label: 'LinkedIn', status: 'free', group: 'social', hint: 'Qua web search' },
  { id: 'youtube', icon: '▶️', label: 'YouTube', status: 'optional', needs: ['YOUTUBE_API_KEY'], group: 'social', hint: 'YouTube Data API hoặc fallback' },
  { id: 'mastodon', icon: '🐘', label: 'Mastodon', status: 'free', group: 'social', hint: 'Hashtag #ai' },
  { id: 'bluesky', icon: '🦋', label: 'Bluesky', status: 'free', group: 'social', hint: 'Public API' },
  { id: 'instagram', icon: '📸', label: 'Instagram', status: 'required', needs: ['RAPID_API_KEY'], group: 'social', hint: 'Cần RapidAPI' },
  { id: 'tiktok', icon: '🎵', label: 'TikTok', status: 'required', needs: ['RAPID_API_KEY'], group: 'social', hint: 'Cần RapidAPI' },
  { id: 'quora', icon: '❓', label: 'Quora', status: 'optional', needs: ['RAPID_API_KEY'], group: 'social', hint: 'Q&A (có thể cũ)' },
];

const PROVIDERS = [
  { id: 'claude', label: '🧠 Claude (Anthropic)' },
  { id: 'openai', label: '🟢 OpenAI (GPT)' },
  { id: 'gemini', label: '🔷 Google Gemini' },
  { id: 'twinexpert', label: '🪞 TwinExpert' },
] as const;

const IMAGE_MODEL_OPTIONS = [
  { provider: 'openai', model: 'dall-e-3', label: 'DALL·E 3 (OpenAI)' },
  { provider: 'openai', model: 'gpt-image-1', label: 'GPT Image 1 (OpenAI)' },
  { provider: 'openai', model: 'dall-e-2', label: 'DALL·E 2 (rẻ hơn)' },
  { provider: 'gemini', model: 'imagen-4.0-generate-001', label: 'Imagen 4 (Google)' },
  { provider: 'gemini', model: 'imagen-3.0-generate-002', label: 'Imagen 3 (Google)' },
];

export default function PipelinePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [scanLimit, setScanLimit] = useState(20);
  const [provider, setProvider] = useState<string>('claude');

  const [articles, setArticles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, boolean>>({});

  const [modelSettings, setModelSettings] = useState<{ claude: string; openai: string; gemini: string }>({ claude: '', openai: '', gemini: '' });
  // Image generation controls
  const [generateImages, setGenerateImages] = useState(false);
  const [imageModelKey, setImageModelKey] = useState('openai|dall-e-3');
  // Write progress (SSE)
  const [writeProgress, setWriteProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  // Article filtering + AI summaries
  const [dateFilter, setDateFilter] = useState<'all' | '1d' | '3d' | '7d'>('all');
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});
  const [summarizingAll, setSummarizingAll] = useState(false);

  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState<Record<string, string>>({});

  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editedHashtags, setEditedHashtags] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string>('');

  useEffect(() => {
    if (step === 2) fetchArticles();
    // Khi vào step 3 (không phải lúc đang viết SSE) thì load bài từ DB.
    if (step === 3 && !loading) fetchPosts();
  }, [step]);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const s = d?.settings || {};
      const flags: Record<string, boolean> = {};
      for (const k of Object.keys(s)) if (s[k]) flags[k] = true;
      setConfiguredKeys(flags);
      setModelSettings({
        claude: s.ANTHROPIC_MODEL || '',
        openai: s.OPENAI_MODEL || '',
        gemini: s.GEMINI_MODEL || '',
      });
    }).catch(() => {});
  }, []);

  const providerModelInfo = (prov: string) => {
    const id = modelSettings[prov as keyof typeof modelSettings];
    const m = id ? findModel(prov, id) : undefined;
    if (prov === 'twinexpert') return { name: 'Theo Twin đã chọn', cost: '' };
    if (!m) return { name: id || 'mặc định', cost: '' };
    return { name: m.label.split(' — ')[0], cost: formatCost(estCostPerPost(m)) };
  };

  const sourceConfigured = (src: SourceDef): boolean => {
    if (src.status === 'free') return true;
    if (!src.needs?.length) return true;
    return src.needs.every(k => configuredKeys[k]);
  };

  const fetchArticles = async () => {
    const res = await fetch(`/api/articles?filter=${sourceFilter}`);
    const data = await res.json();
    const list = data.articles || [];
    setArticles(list);
    // Nạp ai_summary có sẵn từ DB vào cache
    const pre: Record<string, string> = {};
    for (const a of list) if (a.ai_summary) pre[a.id] = a.ai_summary;
    setAiSummaries(prev => ({ ...pre, ...prev }));
  };

  // Ngày bài: ưu tiên published_at thật, fallback created_at (lúc cào). Luôn có giá trị → filter không loại nhầm.
  const articleDate = (a: any): number => {
    const raw = a.published_at || a.created_at;
    if (!raw) return Date.now();
    const t = new Date(raw).getTime();
    return isNaN(t) ? Date.now() : t;
  };
  const hasRealDate = (a: any) => !!a.published_at && !isNaN(new Date(a.published_at).getTime());

  const visibleArticles = () => {
    const now = Date.now();
    const win = dateFilter === '1d' ? 86400000 : dateFilter === '3d' ? 3 * 86400000 : dateFilter === '7d' ? 7 * 86400000 : Infinity;
    return articles
      .filter(a => a.status === 'new')
      .filter(a => dateFilter === 'all' || (now - articleDate(a)) <= win)
      .sort((x, y) => articleDate(y) - articleDate(x));
  };

  const summarizeArticle = async (id: string): Promise<boolean> => {
    if (aiSummaries[id]) return true;
    setSummarizing(s => ({ ...s, [id]: true }));
    try {
      const r = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId: id }) });
      const d = await r.json();
      if (r.ok && d.summary) { setAiSummaries(s => ({ ...s, [id]: d.summary })); return true; }
      toast.error(d.error || 'Tóm tắt thất bại');
      return false;
    } catch (e: any) {
      toast.error(`Lỗi tóm tắt: ${e?.message || e}`);
      return false;
    } finally {
      setSummarizing(s => ({ ...s, [id]: false }));
    }
  };

  const summarizeAll = async () => {
    const todo = visibleArticles().filter(a => !aiSummaries[a.id]);
    if (!todo.length) { toast.info('Tất cả bài hiển thị đã có tóm tắt.'); return; }
    setSummarizingAll(true);
    let ok = 0;
    // Chạy tuần tự nhẹ nhàng để tránh rate-limit free tier
    for (const a of todo) {
      const done = await summarizeArticle(a.id);
      if (done) ok++;
    }
    setSummarizingAll(false);
    toast.success(`✓ Đã tóm tắt ${ok}/${todo.length} bài.`);
  };

  const fetchPosts = async () => {
    const res = await fetch('/api/posts');
    const data = await res.json();
    setPosts(data.posts || []);
  };

  const handleResearch = async () => {
    setLoading(true);
    // Dọn state lựa chọn/tóm tắt của lần trước (tránh rò rỉ giữa các lần scan)
    setSelectedArticles(new Set());
    setSelectedFormat({});
    setAiSummaries({});
    setSummarizing({});
    const tStart = Date.now();
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFilter, limit: scanLimit })
      });
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      const rawText = await res.text();
      let data: any = null;
      try { data = JSON.parse(rawText); } catch {
        // Không phải JSON = function timeout/crash (thường do quét quá nhiều nguồn)
        toast.error(`Scan bị timeout sau ${elapsed}s (quét nhiều nguồn quá lâu).\n→ Chọn 1 nguồn cụ thể (vd Reddit/HN) thay vì "Tất cả", hoặc giảm số bài.\nServer: ${rawText.slice(0, 80)}`);
        return;
      }
      if (!res.ok) {
        const msg = String(data?.error || '');
        if (/password authentication failed|sasl|28P01/i.test(msg)) {
          toast.error(`Lỗi DB auth: kiểm tra SUPABASE_DB_URL trong Vercel env. Mở /settings để test kết nối.\n${msg.slice(0, 200)}`);
        } else {
          toast.error(`Scan thất bại (${elapsed}s): ${msg.slice(0, 200) || 'unknown'}`);
        }
        return;
      }
      const count = data.count ?? 0;
      if (count === 0) {
        toast.warn(`Scan xong (${elapsed}s) nhưng KHÔNG có bài nào.\n• Đa số scraper không cần key (Reddit/HN/GitHub/arXiv) — có thể tin trùng đã có sẵn trong DB.\n• Nguồn X/IG/TikTok cần config RAPID_API_KEY + Subscribe trên rapidapi.com.\n• Vào /settings để xem hướng dẫn lấy key.`);
      } else {
        const foundNote = data.found && data.found > count ? ` (lọc ${count}/${data.found} bài mới nhất)` : '';
        toast.success(`✓ Cào xong ${count} bài${foundNote} trong ${elapsed}s. Sang bước 2 để chọn & viết.`);
      }
      setStep(2);
    } catch (e: any) {
      toast.error(`Lỗi kết nối: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
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
    if (selectedArticles.size === 0) { toast.warn('Chọn ít nhất 1 bài để viết.'); return; }
    for (const id of selectedArticles) {
      if (!selectedFormat[id]) { toast.warn('Chọn format cho tất cả bài đã tick.'); return; }
    }

    const selections = Array.from(selectedArticles).map(id => ({ id, format: selectedFormat[id] }));
    const total = selections.length;
    const [imageProvider, imageModel] = imageModelKey.split('|');

    setLoading(true);
    setWriteProgress({ done: 0, total, failed: 0 });
    // Chuyển sang step 3 ngay để xem bài hiện ra dần
    setPosts([]);
    setStep(3);

    let done = 0, failed = 0;
    const errors: string[] = [];

    try {
      const res = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, provider, generateImages, imageProvider, imageModel }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      while (true) {
        const { value, done: rdone } = await reader.read();
        if (rdone) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
          let ev = 'message'; const dl: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) ev = line.slice(6).trim();
            else if (line.startsWith('data:')) dl.push(line.slice(5).trim());
          }
          if (!dl.length) continue;
          let payload: any = {};
          try { payload = JSON.parse(dl.join('\n')); } catch { continue; }

          if (ev === 'post_done') {
            done = payload.done ?? done + 1;
            // Append bài vừa xong (dedupe theo id) để hiện + sửa ngay
            if (payload.post) setPosts(prev => prev.some((x: any) => x.id === payload.post.id) ? prev : [...prev, payload.post]);
            setWriteProgress({ done, total, failed });
          } else if (ev === 'image_error') {
            toast.warn(`🎨 Tạo ảnh thất bại: ${String(payload.error || '').slice(0, 200)}`);
          } else if (ev === 'post_error') {
            failed++;
            errors.push(payload.error || 'unknown');
            setWriteProgress({ done, total, failed });
          } else if (ev === 'done') {
            done = payload.count ?? done;
            failed = payload.failed ?? failed;
          } else if (ev === 'error') {
            throw new Error(payload.message || 'Stream error');
          }
        }
      }

      if (done > 0) {
        toast.success(`✓ Viết xong ${done}/${total} bài bằng ${provider.toUpperCase()}${failed ? ` · ${failed} bài lỗi` : ''}.`);
      }
      if (failed > 0) {
        const sample = errors[0] || '';
        if (/api[_ ]?key|missing|chưa cấu hình/i.test(sample)) {
          toast.error(`${failed} bài lỗi — thiếu API key cho ${provider.toUpperCase()}. Mở /settings.\n${sample.slice(0, 160)}`);
        } else if (sample) {
          toast.error(`${failed} bài lỗi: ${sample.slice(0, 200)}`);
        }
      }
      if (done === 0 && failed === 0) {
        toast.warn('Không có bài nào được viết.');
      }
      setSelectedArticles(new Set());
    } catch (e: any) {
      toast.error(`Lỗi viết bài: ${e?.message || e}`);
    } finally {
      setLoading(false);
      setWriteProgress(null);
      // Đồng bộ lại từ DB (nguồn sự thật) + cập nhật articles (bỏ bài đã viết khỏi step 2)
      setTimeout(() => { fetchPosts(); fetchArticles(); }, 300);
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
            {/* Stats bar */}
            <div className="source-stats">
              <span className="source-stat"><b>{SOURCES.length}</b> nguồn</span>
              <span className="source-stat ok">🟢 <b>{SOURCES.filter(s => sourceConfigured(s)).length}</b> sẵn sàng</span>
              <span className="source-stat warn">🟡 <b>{SOURCES.filter(s => !sourceConfigured(s)).length}</b> cần key</span>
            </div>

            {/* Tất cả */}
            <div className="source-grid" style={{ marginBottom: 10 }}>
              <button
                className={`source-card ${sourceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSourceFilter('all')}
                title="Quét toàn bộ nguồn cùng lúc"
              >
                <span className="source-icon">🌐</span>
                <span className="source-label">Tất cả</span>
                <span className="source-badge full">{SOURCES.length} nguồn</span>
              </button>
            </div>

            {/* Nhóm nội dung tốt */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-body-muted)', margin: '8px 0 6px' }}>📚 NỘI DUNG TỐT (viết bài chất lượng)</div>
            <div className="source-grid">
              {SOURCES.filter(s => s.group === 'content').map(s => {
                const ok = sourceConfigured(s);
                return (
                  <button key={s.id} className={`source-card ${sourceFilter === s.id ? 'active' : ''} ${!ok ? 'needs-key' : ''}`} onClick={() => setSourceFilter(s.id)} title={s.hint}>
                    <span className="source-icon">{s.icon}</span>
                    <span className="source-label">{s.label}</span>
                    <span className={`source-badge ${ok ? 'ok' : 'warn'}`}>{ok ? '✓' : '⚠ key'}</span>
                  </button>
                );
              })}
            </div>

            {/* Nhóm social */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-body-muted)', margin: '14px 0 6px' }}>💬 SOCIAL / XU HƯỚNG (nội dung ngắn, cập nhật)</div>
            <div className="source-grid">
              {SOURCES.filter(s => s.group === 'social').map(s => {
                const ok = sourceConfigured(s);
                return (
                  <button key={s.id} className={`source-card ${sourceFilter === s.id ? 'active' : ''} ${!ok ? 'needs-key' : ''}`} onClick={() => setSourceFilter(s.id)} title={s.hint + (s.needs ? ` · cần: ${s.needs.join(', ')}` : '')}>
                    <span className="source-icon">{s.icon}</span>
                    <span className="source-label">{s.label}</span>
                    <span className={`source-badge ${ok ? 'ok' : 'warn'}`}>{ok ? '✓' : '⚠ key'}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--color-body-muted)' }}>
              ✓ = sẵn sàng · ⚠ = cần API key (<a href="/settings" style={{ color: 'var(--color-primary)' }}>/settings</a>). Mẹo: chọn 1 nguồn <b>Nội dung tốt</b> để viết bài chất lượng + nhanh.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Lấy tối đa:</label>
            <select className="input-field" style={{ width: 'auto', padding: '8px 12px' }} value={scanLimit} onChange={e => setScanLimit(Number(e.target.value))}>
              <option value={5}>5 bài</option>
              <option value={10}>10 bài</option>
              <option value={20}>20 bài</option>
              <option value={30}>30 bài</option>
              <option value={50}>50 bài</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--color-body-muted)' }}>Lấy {scanLimit} bài MỚI NHẤT (đỡ ngập, xử lý nhanh)</span>
            <button className="btn-primary" onClick={handleResearch} disabled={loading} style={{ marginLeft: 'auto' }}>
              {loading ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="spinner" />Đang cào (30-90s)...</span>) : '⚡ Bắt đầu Auto-Scan'}
            </button>
          </div>
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
            {(() => {
              const info = providerModelInfo(provider);
              return (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-body-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>Model: <b style={{ color: 'var(--color-ink)' }}>{info.name}</b></span>
                  {info.cost && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>💰 {info.cost}{generateImages ? ' + phí ảnh' : ''}</span>}
                  <a href="/settings#sec-ai-vi-t-b-i" style={{ color: 'var(--color-primary)', fontSize: 12 }}>đổi model →</a>
                </div>
              );
            })()}

            {/* Image generation controls */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-divider-soft)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                <input type="checkbox" style={{ width: 16, height: 16, cursor: 'pointer' }} checked={generateImages} onChange={e => setGenerateImages(e.target.checked)} />
                🎨 Tạo ảnh minh hoạ cho mỗi bài
              </label>
              {generateImages ? (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-body-muted)' }}>Model ảnh:</span>
                  <select className="input-field" style={{ padding: '6px 10px', width: 'auto', fontSize: 13 }} value={imageModelKey} onChange={e => setImageModelKey(e.target.value)}>
                    {IMAGE_MODEL_OPTIONS.map(m => (
                      <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>{m.label}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--color-warn, #f59e0b)' }}>⚠ Tốn phí API ảnh + chậm hơn</span>
                </div>
              ) : (
                <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-body-muted)' }}>
                  Đang TẮT — viết nhanh, không tốn phí ảnh. Bạn tự thêm ảnh khi đăng FB.
                </p>
              )}
            </div>

            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--color-body-muted)' }}>
              Cần thêm API key? Vào <a href="/settings" style={{ color: 'var(--color-primary)' }}>⚙️ Settings</a>.
            </p>
          </div>

          <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 18, color: 'var(--color-ink)' }}>Tin chờ xử lý ({visibleArticles().length})</h3>
            <button
              className="btn-primary mobile-full-btn"
              onClick={handleBatchWrite}
              disabled={loading || selectedArticles.size === 0}
            >
              {loading ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="spinner" />Đang viết{generateImages ? ' & tạo ảnh' : ''} ({writeProgress?.done ?? 0}/{selectedArticles.size})...</span>) : `🤖 ${PROVIDERS.find(p => p.id === provider)?.label.split(' ')[1] || provider} viết (${selectedArticles.size} bài)`}
            </button>
          </div>

          {/* Bộ lọc ngày + tóm tắt */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <span style={{ fontSize: 13, color: 'var(--color-body-muted)' }}>Lọc:</span>
            {([['1d', 'Hôm nay'], ['3d', '3 ngày'], ['7d', '7 ngày'], ['all', 'Tất cả']] as const).map(([v, label]) => (
              <button key={v} className={`tag ${dateFilter === v ? 'active' : ''}`} onClick={() => setDateFilter(v)}>{label}</button>
            ))}
            <button
              className="tag"
              style={{ marginLeft: 'auto' }}
              onClick={summarizeAll}
              disabled={summarizingAll}
              title="Dùng AI free (Gemini) tóm tắt mọi bài đang hiện"
            >
              {summarizingAll ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spinner" />Đang tóm tắt...</span> : '✨ Tóm tắt tất cả (AI free)'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {visibleArticles().map(a => {
              const ai = aiSummaries[a.id];
              const rawSummary = cleanText(a.summary);
              return (
              <div key={a.id} className="card mobile-col" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer', borderColor: selectedArticles.has(a.id) ? 'var(--color-primary)' : undefined }} onClick={() => toggleArticleSelection(a.id)}>
                <input type="checkbox" style={{ width: 18, height: 18, marginTop: 4, cursor: 'pointer' }} checked={selectedArticles.has(a.id)} readOnly />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--color-surface-pearl)', padding: '4px 8px', borderRadius: 4, color: 'var(--color-body-muted)' }}>{a.source_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-body-muted)' }}>{hasRealDate(a) ? new Date(articleDate(a)).toLocaleDateString('vi-VN') : '🆕 vừa cào'}</span>
                    <a href={a.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', marginLeft: 'auto' }}>🔗 Bài gốc</a>
                  </div>
                  <h4 style={{ marginBottom: 8, fontSize: 16, color: 'var(--color-ink)', lineHeight: 1.4 }}>{cleanText(a.title)}</h4>

                  {ai ? (
                    <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--color-surface-pearl)', borderRadius: 8, borderLeft: '3px solid var(--color-primary)' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, marginBottom: 4 }}>✨ Tóm tắt AI</div>
                      <p style={{ fontSize: 14, color: 'var(--color-ink)', lineHeight: 1.55, margin: 0 }}>{ai}</p>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-body-muted)', marginBottom: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {rawSummary || '(không có mô tả)'}
                    </p>
                  )}

                  <div className="mobile-wrap" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {!ai && (
                      <button className="tag" onClick={() => summarizeArticle(a.id)} disabled={summarizing[a.id]} title="AI free tóm tắt bài này">
                        {summarizing[a.id] ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spinner" />...</span> : '✨ Tóm tắt'}
                      </button>
                    )}
                    <span style={{ width: 1, height: 18, background: 'var(--color-hairline)' }} />
                    <button className={`tag ${selectedFormat[a.id] === 'pov' ? 'active' : ''}`} onClick={() => setArticleSelection(a.id, 'pov')}>📝 POV</button>
                    <button className={`tag ${selectedFormat[a.id] === 'info' ? 'active' : ''}`} onClick={() => setArticleSelection(a.id, 'info')}>📊 Info</button>
                    <button className={`tag ${selectedFormat[a.id] === 'toplist' ? 'active' : ''}`} onClick={() => setArticleSelection(a.id, 'toplist')}>📋 Toplist</button>
                    <button className={`tag ${selectedFormat[a.id] === 'howto' ? 'active' : ''}`} onClick={() => setArticleSelection(a.id, 'howto')}>🛠 How-to</button>
                  </div>
                </div>
              </div>
            );})}
            {visibleArticles().length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-body-muted)' }}>
                Không có bài nào trong khoảng thời gian này. Thử đổi bộ lọc sang <b>Tất cả</b>, hoặc quay lại bước 1 để Auto-Scan thêm.
              </div>
            )}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, color: 'var(--color-ink)' }}>Bài chờ copy ({posts.filter(p => p.status === 'draft').length})</h3>
            <p style={{ fontSize: 13, color: 'var(--color-body-muted)' }}>Click <b>Copy</b> → mở Facebook → paste là xong.</p>
          </div>

          {writeProgress && (
            <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--color-primary)' }}>
              <span className="spinner" style={{ color: 'var(--color-primary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  Đang viết song song... {writeProgress.done}/{writeProgress.total} xong
                  {writeProgress.failed > 0 && <span style={{ color: 'var(--color-danger)' }}> · {writeProgress.failed} lỗi</span>}
                </div>
                <div style={{ marginTop: 6, height: 6, background: 'var(--color-surface-pearl)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(((writeProgress.done + writeProgress.failed) / Math.max(writeProgress.total, 1)) * 100)}%`, background: 'var(--color-primary)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-body-muted)', marginTop: 4 }}>Bài nào xong hiện ngay bên dưới — bạn sửa được luôn.</div>
              </div>
            </div>
          )}

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
                <div className="mobile-img-col" style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Ảnh AI ưu tiên hiển thị trước */}
                  {p.generated_image_url ? (
                    <div>
                      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--color-surface-pearl)' }}>
                        <span style={{ position: 'absolute', top: 6, left: 6, zIndex: 10, background: 'rgba(37,99,235,0.9)', color: 'white', fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>🎨 Ảnh AI</span>
                        <a href={p.generated_image_url} target="_blank" rel="noreferrer" title="Mở ảnh full size">
                          <img src={p.generated_image_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
                        </a>
                      </div>
                      <button onClick={() => downloadImage(p.generated_image_url, `ai-${p.id}.jpg`)} style={{ fontSize: 12, padding: '8px 10px', background: 'var(--color-surface-pearl)', border: '1px solid var(--color-hairline)', borderRadius: 6, cursor: 'pointer', width: '100%', marginTop: 6 }}>
                        ⬇️ Tải ảnh AI
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-surface-pearl)', border: '1px dashed var(--color-hairline)', fontSize: 12, color: 'var(--color-body-muted)', textAlign: 'center' }}>
                      🎨 Chưa có ảnh AI.<br/>Bật <b>&quot;Tạo ảnh&quot;</b> ở bước 2 trước khi viết để có ảnh AI.
                    </div>
                  )}

                  {/* Ảnh gốc từ bài (nếu có) — phụ */}
                  {p.original_image_url && (
                    <div>
                      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--color-surface-pearl)' }}>
                        <span style={{ position: 'absolute', top: 6, left: 6, zIndex: 10, background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>Ảnh gốc (từ bài)</span>
                        <a href={p.original_image_url} target="_blank" rel="noreferrer" title="Mở ảnh full size">
                          <img
                            src={p.original_image_url.startsWith('data:') ? p.original_image_url : `/api/image-proxy?url=${encodeURIComponent(p.original_image_url)}`}
                            style={{ width: '100%', minHeight: 200, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </a>
                      </div>
                      <button onClick={() => downloadImage(p.original_image_url, `original-${p.id}.jpg`)} style={{ fontSize: 12, padding: '8px 10px', background: 'var(--color-surface-pearl)', border: '1px solid var(--color-hairline)', borderRadius: 6, cursor: 'pointer', width: '100%', marginTop: 6 }}>
                        ⬇️ Tải ảnh gốc
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
