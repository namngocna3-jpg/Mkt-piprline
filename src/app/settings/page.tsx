"use client";
import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Eye, EyeOff, Database, PenLine } from 'lucide-react';
import { toast } from '../components/Toast';
import { PERSONA_PRESETS } from '@/lib/ai/personas';
import { TEXT_MODELS, IMAGE_MODELS, estCostPerPost, formatCost, type ModelDef } from '@/lib/ai/models';

type Settings = Record<string, string>;

function sectionAnchor(title: string) {
  return 'sec-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

type Item = {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  secret?: boolean;
  signupUrl?: string;
  freeTier?: string;
  steps?: string[];
  // Dropdown model selector — kèm giá để ước tính credit
  modelGroup?: 'claude' | 'openai' | 'gemini' | 'image-openai' | 'image-gemini';
  // Dropdown lựa chọn tĩnh
  selectOptions?: { value: string; label: string }[];
};

const SECTIONS: { title: string; subtitle: string; items: Item[] }[] = [
  {
    title: 'AI Viết bài',
    subtitle: 'Cấu hình các provider sinh text cho Dashboard.',
    items: [
      {
        key: 'ANTHROPIC_API_KEY', label: 'Anthropic Claude', placeholder: 'sk-ant-...', secret: true,
        signupUrl: 'https://console.anthropic.com',
        freeTier: 'Trial $5 credit. Phải nạp tiền sau khi hết.',
        steps: [
          'Vào console.anthropic.com → Sign up',
          'Settings → API Keys → Create Key',
          'Copy key dạng sk-ant-... và paste vào đây',
        ],
      },
      { key: 'ANTHROPIC_MODEL', label: 'Claude model', placeholder: 'claude-sonnet-4-6', modelGroup: 'claude', hint: 'Chọn model để tính chi phí. Haiku rẻ nhất.' },
      {
        key: 'OPENAI_API_KEY', label: 'OpenAI', placeholder: 'sk-...', secret: true,
        signupUrl: 'https://platform.openai.com/api-keys',
        freeTier: 'Trial $5 credit cho account mới. Phải nạp tiền sau.',
        steps: [
          'Vào platform.openai.com → Sign up',
          'Bấm avatar → View API keys → Create new secret key',
          'Copy sk-... và paste vào đây',
        ],
      },
      { key: 'OPENAI_MODEL', label: 'OpenAI model', placeholder: 'gpt-4o-mini', modelGroup: 'openai', hint: 'GPT-4o mini rẻ nhất.' },
      {
        key: 'GEMINI_API_KEY', label: 'Google Gemini', placeholder: 'AIza...', secret: true,
        signupUrl: 'https://aistudio.google.com/apikey',
        freeTier: '✅ FREE: 15 req/phút, 1500 req/ngày (gemini-2.0-flash). Tuyệt vời cho dev.',
        steps: [
          'Đăng nhập aistudio.google.com bằng Google account',
          '"Get API key" → "Create API key in new project"',
          'Copy AIza... và paste vào đây',
        ],
      },
      { key: 'GEMINI_MODEL', label: 'Gemini model', placeholder: 'gemini-2.0-flash', modelGroup: 'gemini', hint: 'Gemini 2.0 Flash MIỄN PHÍ.' },
    ],
  },
  {
    title: 'TwinExpert (Twin Chat)',
    subtitle: '✅ Twin GẮN TỰ ĐỘNG với API key — bạn KHÔNG cần nhập Twin ID. Chỉ cần dán key (ak_...) rồi bấm "🔬 Test gửi thử Twin".',
    items: [
      { key: 'TWINEXPERT_API_KEY', label: 'TwinExpert API key', placeholder: 'ak_...', secret: true, hint: 'twinexpert.com/profile/api-keys — twin tự động theo key này.' },
      { key: 'TWINEXPERT_TWIN_ID', label: 'Twin ID (không bắt buộc)', placeholder: 'để trống — tự động theo key', hint: 'KHÔNG cần điền. API tự lấy twin từ key. Để trống là được.' },
    ],
  },
  {
    title: 'Tạo ảnh',
    subtitle: '⚠️ KHÔNG cần key riêng — tạo ảnh dùng CHUNG key OpenAI / Gemini bạn đã nhập ở mục "AI Viết bài" phía trên. Ở đây chỉ chọn provider + model.',
    items: [
      {
        key: 'IMAGE_PROVIDER', label: 'Provider ảnh', selectOptions: [
          { value: 'openai', label: 'OpenAI (DALL·E / GPT Image)' },
          { value: 'gemini', label: 'Google (Imagen)' },
        ],
        hint: 'Dùng key tương ứng đã nhập ở trên. Mặc định: OpenAI.',
      },
      { key: 'IMAGE_MODEL', label: 'Model ảnh', modelGroup: 'image-openai', hint: 'Danh sách model đổi theo Provider đã chọn ở trên.' },
    ],
  },
  {
    title: 'Vision (mô tả ảnh) — Multi-provider',
    subtitle: 'Khi 1 provider rate-limit hoặc hết quota, hệ thống tự fallback theo thứ tự. Cấu hình càng nhiều càng ít bị nghẽn. Tesseract OCR luôn chạy (client-side, không cần key).',
    items: [
      {
        key: 'GROQ_API_KEY', label: 'Groq (recommend)', placeholder: 'gsk_...', secret: true,
        signupUrl: 'https://console.groq.com/keys',
        freeTier: '✅ FREE rất hào phóng: ~30 RPM, Llama-4-Scout-17B vision. Inference siêu nhanh.',
        steps: [
          'Vào console.groq.com → Sign up (email/Google)',
          'API Keys (sidebar trái) → Create API Key',
          'Đặt tên (vd "mkt-pipeline") → Submit → Copy gsk_...',
        ],
      },
      {
        key: 'OPENROUTER_API_KEY', label: 'OpenRouter', placeholder: 'sk-or-...', secret: true,
        signupUrl: 'https://openrouter.ai/keys',
        freeTier: '✅ Có model có suffix :free hoàn toàn miễn phí (gemini-2.0-flash-exp:free, llama-3.2-11b-vision:free)',
        steps: [
          'Vào openrouter.ai → Sign in (Google/GitHub)',
          'Settings → Keys → Create Key',
          'Copy sk-or-... và paste',
          '(Optional) Đổi model ở field bên dưới, mặc định: google/gemini-2.0-flash-exp:free',
        ],
      },
      { key: 'OPENROUTER_VISION_MODEL', label: 'OpenRouter vision model', placeholder: 'google/gemini-2.0-flash-exp:free', hint: 'Mặc định: google/gemini-2.0-flash-exp:free. Có thể đổi: meta-llama/llama-3.2-11b-vision-instruct:free' },
      {
        key: 'HUGGINGFACE_API_KEY', label: 'HuggingFace', placeholder: 'hf_...', secret: true,
        signupUrl: 'https://huggingface.co/settings/tokens',
        freeTier: '✅ Free Inference API (rate-limit nhẹ). Dùng BLIP cho image captioning.',
        steps: [
          'Vào huggingface.co → Sign up',
          'Avatar → Settings → Access Tokens → New token',
          'Loại: Read → Generate → Copy hf_... và paste',
        ],
      },
    ],
  },
  {
    title: 'Web Search — Multi-provider Router',
    subtitle: 'Router tự fallback: Brave → Tavily → SerpAPI → Google CSE → NewsAPI → DuckDuckGo (free) → Wikipedia (free). DuckDuckGo + Wiki luôn chạy không cần key — đủ key thì hầu như không bao giờ nghẽn.',
    items: [
      {
        key: 'BRAVE_API_KEY', label: 'Brave Search', placeholder: 'BSA...', secret: true,
        signupUrl: 'https://api.search.brave.com/app/keys',
        freeTier: '✅ FREE 2000 query/tháng. Phải add card nhưng KHÔNG charge ở free tier.',
        steps: [
          'Vào api.search.brave.com/app → Sign up',
          'Subscribe gói "Free" → Add credit card (không charge nếu trong free tier)',
          'API Keys → Add API Key → Copy BSA... và paste',
        ],
      },
      {
        key: 'TAVILY_API_KEY', label: 'Tavily (recommend AI)', placeholder: 'tvly-...', secret: true,
        signupUrl: 'https://app.tavily.com/home',
        freeTier: '✅ FREE 1000 query/tháng. Tối ưu cho LLM/agent. Không cần card.',
        steps: [
          'Vào app.tavily.com → Sign up (Google/GitHub)',
          'Dashboard → API Keys → Copy tvly-...',
        ],
      },
      {
        key: 'SERPAPI_API_KEY', label: 'SerpAPI', placeholder: '...', secret: true,
        signupUrl: 'https://serpapi.com/manage-api-key',
        freeTier: '✅ FREE 100 query/tháng. Google results chính chủ.',
        steps: [
          'Vào serpapi.com → Sign up',
          'Dashboard → API Key (hiện sẵn) → Copy paste',
        ],
      },
      {
        key: 'GOOGLE_CSE_KEY', label: 'Google CSE Key', placeholder: 'AIza...', secret: true,
        signupUrl: 'https://developers.google.com/custom-search/v1/introduction',
        freeTier: '✅ FREE 100 query/ngày = ~3000/tháng. Cần kèm cả CSE_ID bên dưới.',
        steps: [
          'Vào console.cloud.google.com → Tạo project',
          'APIs & Services → Library → tìm "Custom Search API" → Enable',
          'APIs & Services → Credentials → Create Credentials → API key',
          'Copy AIza... → paste ô này',
        ],
      },
      {
        key: 'GOOGLE_CSE_ID', label: 'Google CSE ID (cx)', placeholder: '01234567:abcdef',
        signupUrl: 'https://programmablesearchengine.google.com/controlpanel/all',
        steps: [
          'Vào programmablesearchengine.google.com → Add',
          'Đặt tên + chọn "Search the entire web" → Create',
          'Customize → Search engine ID → Copy (dạng abc:xyz)',
        ],
      },
      {
        key: 'NEWSAPI_KEY', label: 'NewsAPI', placeholder: '...', secret: true,
        signupUrl: 'https://newsapi.org/register',
        freeTier: '✅ FREE 100 req/ngày cho dev (giới hạn: không dùng production trên domain thật).',
        steps: [
          'Vào newsapi.org/register → Đăng ký',
          'Account → API Key (hiện sẵn) → Copy paste',
        ],
      },
    ],
  },
  {
    title: 'Research — Social Media (cần RapidAPI key duy nhất)',
    subtitle: 'RAPID_API_KEY là 1 key dùng chung cho TẤT CẢ scraper RapidAPI. Nhưng MỖI dịch vụ cào (X / IG / TikTok / YouTube) là 1 SUBSCRIPTION RIÊNG trên rapidapi.com — bạn phải vào marketplace và bấm "Subscribe" (gói Free) cho từng cái. Nếu không subscribe, scraper sẽ fallback sang DuckDuckGo/Wikipedia.',
    items: [
      {
        key: 'RAPID_API_KEY', label: 'RapidAPI key (1 cho tất cả)', placeholder: 'rapidapi...', secret: true,
        signupUrl: 'https://rapidapi.com/auth/sign-up',
        freeTier: '✅ Sign-up free. Key duy nhất dùng cho cả X/IG/TikTok/YouTube/LinkedIn.',
        steps: [
          'Vào rapidapi.com → Sign up',
          'Avatar → Hub → My Apps → Default Application → Security',
          'Copy "X-RapidAPI-Key" và paste',
          '⚠️ Cần Subscribe RIÊNG mỗi API bên dưới (free tier):',
          '• X (Twitter): rapidapi.com/davethebeast/api/twitter-api47 → Subscribe (Basic 100req/mo)',
          '• Instagram: rapidapi.com/restyler/api/instagram-scraper-api2 → Subscribe (Basic 500req/mo)',
          '• TikTok: rapidapi.com/yi005/api/tiktok-scraper7 → Subscribe (Basic 500req/mo)',
          '• YouTube: rapidapi.com/ytdlfree/api/youtube-v311 → Subscribe',
        ],
      },
      {
        key: 'RAPIDAPI_X_HOST', label: 'RapidAPI X host (optional)', placeholder: 'twitter-api47.p.rapidapi.com',
        hint: 'Mặc định: twitter-api47.p.rapidapi.com (parser tối ưu cho cái này). Đổi nếu bạn subscribe twitter API khác.',
      },
      {
        key: 'RAPIDAPI_IG_HOST', label: 'RapidAPI Instagram host (optional)', placeholder: 'instagram-scraper-api2.p.rapidapi.com',
        hint: 'Mặc định: instagram-scraper-api2.p.rapidapi.com.',
      },
      {
        key: 'RAPIDAPI_TIKTOK_HOST', label: 'RapidAPI TikTok host (optional)', placeholder: 'tiktok-scraper7.p.rapidapi.com',
        hint: 'Mặc định: tiktok-scraper7.p.rapidapi.com. Đổi nếu bạn dùng scraper khác.',
      },
      {
        key: 'RAPIDAPI_YOUTUBE_HOST', label: 'RapidAPI YouTube host (optional)', placeholder: 'youtube-v311.p.rapidapi.com',
        hint: 'Mặc định: youtube-v311.p.rapidapi.com. Chỉ dùng khi YOUTUBE_API_KEY (bên dưới) không có.',
      },
      {
        key: 'YOUTUBE_API_KEY', label: 'YouTube Data API v3 (ưu tiên)', placeholder: 'AIza...', secret: true,
        signupUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
        freeTier: '✅ FREE 10000 unit/ngày (1 search = 100 unit ⇒ 100 search/ngày). Tốt hơn RapidAPI nhiều.',
        steps: [
          'Vào console.cloud.google.com → Project (có thể dùng chung với CSE)',
          'APIs & Services → Library → "YouTube Data API v3" → Enable',
          'Credentials → API key (có thể dùng lại key của CSE)',
          'Copy AIza... và paste',
        ],
      },
      {
        key: 'PRODUCTHUNT_TOKEN', label: 'Product Hunt token (optional)', placeholder: '...', secret: true,
        signupUrl: 'https://api.producthunt.com/v2/oauth/applications',
        freeTier: '✅ FREE. Không có token thì scraper dùng RSS thay thế (cũng OK).',
        steps: [
          'Vào producthunt.com/v2/oauth/applications → Add Application',
          'Tạo app: Name bất kỳ, Redirect URI: http://localhost',
          'Sau khi tạo → "Create Token" (developer token) → Copy',
        ],
      },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [twinValidation, setTwinValidation] = useState<{ valid?: boolean; error?: string; usage?: any } | null>(null);
  const [validating, setValidating] = useState(false);
  const [twins, setTwins] = useState<any[]>([]);
  const [twinsLoading, setTwinsLoading] = useState(false);
  const [dbTest, setDbTest] = useState<any>(null);
  const [dbTesting, setDbTesting] = useState(false);
  const [twinTest, setTwinTest] = useState<any>(null);
  const [twinTesting, setTwinTesting] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { if (d.settings) setSettings(d.settings); });
  }, []);

  const update = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setLoading(true); setSaveMsg('');
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
      const d = await res.json();
      if (d.success) {
        setSaveMsg('✓ Đã lưu');
        toast.success('✓ Đã lưu settings.');
      } else {
        const msg = String(d?.error || 'unknown');
        if (/password authentication failed|sasl|28P01|tenant or user not found/i.test(msg)) {
          toast.error(`Lỗi kết nối DB: ${msg.slice(0, 200)}.\nBấm "Test DB" ở đầu trang để xem chẩn đoán chi tiết.`);
        } else {
          toast.error(`Lỗi: ${msg.slice(0, 200)}`);
        }
        setSaveMsg(`Lỗi: ${msg}`);
      }
    } catch (e: any) {
      toast.error(`Lỗi kết nối: ${e?.message || e}`);
    } finally {
      setLoading(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const testDb = async () => {
    setDbTesting(true); setDbTest(null);
    try {
      const r = await fetch('/api/db-test');
      const d = await r.json();
      setDbTest(d);
      if (d.ok) toast.success('✓ Kết nối DB OK.');
      else toast.error(`DB lỗi: ${d.message || 'unknown'}`);
    } catch (e: any) {
      toast.error(`DB test failed: ${e?.message || e}`);
    } finally {
      setDbTesting(false);
    }
  };

  const validateTwin = async () => {
    if (!settings.TWINEXPERT_API_KEY) return;
    setValidating(true); setTwinValidation(null);
    const r = await fetch('/api/chat/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: settings.TWINEXPERT_API_KEY }) });
    setTwinValidation(await r.json());
    setValidating(false);
  };

  const fetchTwins = async () => {
    setTwinsLoading(true);
    const r = await fetch(`/api/twinexpert/twins?apiKey=${encodeURIComponent(settings.TWINEXPERT_API_KEY || '')}`);
    const d = await r.json();
    setTwins(d.twins || []);
    setTwinsLoading(false);
  };

  const testTwin = async () => {
    setTwinTesting(true); setTwinTest(null);
    try {
      const r = await fetch('/api/twinexpert/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.TWINEXPERT_API_KEY, twinId: settings.TWINEXPERT_TWIN_ID }),
      });
      const d = await r.json();
      setTwinTest(d);
      if (d.ok) toast.success('✓ TwinExpert hoạt động!');
      else toast.error('TwinExpert lỗi — xem chi tiết bên dưới.');
    } catch (e: any) {
      toast.error(`Test lỗi: ${e?.message || e}`);
    } finally {
      setTwinTesting(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Settings</h1>
      <p style={{ color: 'var(--color-body-muted)', marginBottom: 24, fontSize: 17 }}>
        API key được lưu trong Supabase Postgres, không cần restart server. Hệ thống ưu tiên giá trị ở DB, fallback sang .env.
      </p>

      {/* DB Connection Test Card */}
      <section style={{ marginBottom: 32 }} id="sec-db">
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <Database size={18} />
            <h3 style={{ margin: 0, fontSize: 16 }}>Database connection</h3>
            <button className="btn-secondary" onClick={testDb} disabled={dbTesting} style={{ marginLeft: 'auto' }}>
              {dbTesting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spinner" />Đang test...</span> : 'Test DB connection'}
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-body-muted)', marginBottom: 8 }}>
            Nếu thấy lỗi <code style={{ fontSize: 12 }}>password authentication failed</code> hoặc <code style={{ fontSize: 12 }}>tenant or user not found</code> — bấm Test để xem chẩn đoán cụ thể.
          </p>
          {dbTest && (
            <div className="card-pearl" style={{ padding: 12, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
              <div style={{ fontWeight: 600, color: dbTest.ok ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)', marginBottom: 6 }}>
                {dbTest.ok ? '✓' : '✕'} {dbTest.message}
              </div>

              {/* Parsed connection info — luôn hiển thị */}
              {dbTest.details && typeof dbTest.details === 'object' && 'host' in dbTest.details && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--color-canvas)', padding: 8, borderRadius: 6, marginTop: 6 }}>
                  <div>scheme: <b>{dbTest.details.scheme}</b></div>
                  <div>host: <b>{dbTest.details.host}</b> · port: <b>{dbTest.details.port}</b></div>
                  <div>database: <b>{dbTest.details.database}</b></div>
                  <div>username: <b>{dbTest.details.username}</b> ({dbTest.details.expected_pooler_user_format})</div>
                  <div>password: <b>{dbTest.details.password_preview}</b> (dài {dbTest.details.password_length}, URL-encoded: {String(dbTest.details.password_was_url_encoded)})</div>
                  {dbTest.details.password_special_chars && <div>ký tự đặc biệt trong password: <b>{dbTest.details.password_special_chars}</b></div>}
                  {dbTest.ok && dbTest.details.server_user && (
                    <>
                      <div style={{ marginTop: 6 }}>server_user: {dbTest.details.server_user}</div>
                      <div>server_db: {dbTest.details.server_db}</div>
                      <div>version: {dbTest.details.version}</div>
                    </>
                  )}
                </div>
              )}

              {!dbTest.ok && dbTest.details?.error && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-body-muted)' }}>Xem error gốc</summary>
                  <code style={{ display: 'block', marginTop: 4, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{dbTest.details.error}{dbTest.details.code ? ` (code: ${dbTest.details.code})` : ''}</code>
                </details>
              )}

              {!!dbTest.hints?.length && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Gợi ý fix:</div>
                  <ul style={{ marginLeft: 18 }}>
                    {dbTest.hints.map((h: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{h}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="settings-layout">
        {/* Sidebar nav */}
        <nav className="settings-nav">
          <a href="#sec-db">📡 Database</a>
          <a href="#sec-persona">✍️ Phong cách viết</a>
          {SECTIONS.map(section => (
            <a key={section.title} href={`#${sectionAnchor(section.title)}`}>{section.title.split(' — ')[0].split(' (')[0]}</a>
          ))}
        </nav>

        {/* Sections */}
        <div>

        {/* Writer Persona */}
        <section id="sec-persona" style={{ marginBottom: 36, scrollMarginTop: 80 }}>
          <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><PenLine size={18} /> Phong cách viết (Persona)</h3>
          <p style={{ color: 'var(--color-body-muted)', fontSize: 14, marginBottom: 16 }}>
            Đây là &quot;giọng văn&quot; AI dùng khi viết bài ở Pipeline. Chọn 1 preset rồi tinh chỉnh, hoặc tự viết hoàn toàn. Để trống = dùng preset Growth &amp; Content mặc định.
          </p>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--color-body-muted)', marginBottom: 8 }}>Preset (bấm để áp dụng, sau đó sửa tuỳ ý):</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {PERSONA_PRESETS.map(p => (
                <button
                  key={p.id}
                  className="tag"
                  title={p.desc}
                  onClick={() => { update('WRITER_PERSONA', p.prompt); toast.info(`Đã áp dụng preset "${p.name}". Bấm Lưu để xác nhận.`); }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <textarea
              className="input-field"
              style={{ minHeight: 220, resize: 'vertical', fontFamily: 'var(--font-text)', fontSize: 14, lineHeight: 1.6, width: '100%' }}
              placeholder="Mô tả persona/giọng văn của bạn... (VD: Bạn là [tên], chuyên gia về [niche]. Giọng văn [đặc điểm]. Luôn [quy tắc]...)"
              value={settings.WRITER_PERSONA || ''}
              onChange={e => update('WRITER_PERSONA', e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-body-muted)' }}>
                {(settings.WRITER_PERSONA || '').length} ký tự
                {!settings.WRITER_PERSONA && ' · đang dùng preset mặc định'}
              </span>
              {settings.WRITER_PERSONA && (
                <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => { update('WRITER_PERSONA', ''); toast.info('Đã xoá persona tuỳ chỉnh, sẽ dùng mặc định.'); }}>
                  ↺ Reset về mặc định
                </button>
              )}
            </div>
          </div>
        </section>

      {SECTIONS.map(section => (
        <section key={section.title} id={sectionAnchor(section.title)} style={{ marginBottom: 36, scrollMarginTop: 80 }}>
          <h3 style={{ marginBottom: 4 }}>{section.title}</h3>
          <p style={{ color: 'var(--color-body-muted)', fontSize: 14, marginBottom: 16 }}>{section.subtitle}</p>
          <div className="card" style={{ padding: 6 }}>
            {section.items.map((item, idx) => {
              const shown = !!reveal[item.key];
              const hasTutorial = !!(item.steps?.length || item.signupUrl || item.freeTier);
              // Model dropdown options (đổi theo provider cho ảnh)
              let modelOpts: ModelDef[] | null = null;
              if (item.modelGroup === 'claude' || item.modelGroup === 'openai' || item.modelGroup === 'gemini') {
                modelOpts = TEXT_MODELS[item.modelGroup];
              } else if (item.modelGroup === 'image-openai' || item.modelGroup === 'image-gemini') {
                const imgProv = (settings.IMAGE_PROVIDER || 'openai');
                modelOpts = IMAGE_MODELS[imgProv] || IMAGE_MODELS.openai;
              }
              const curModel = modelOpts?.find(m => m.id === settings[item.key]);
              return (
                <div key={item.key} style={{ padding: '14px 16px', borderBottom: idx < section.items.length - 1 ? '1px solid var(--color-divider-soft)' : 'none' }}>
                  <div className="settings-row" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{item.label}</div>
                      {item.hint && <div style={{ fontSize: 12, color: 'var(--color-body-muted)', marginTop: 2 }}>{item.hint}</div>}
                      {item.freeTier && <div style={{ fontSize: 11, color: 'var(--color-success, #10b981)', marginTop: 4, fontWeight: 500 }}>{item.freeTier}</div>}
                      {modelOpts && curModel && (
                        <div style={{ fontSize: 11, color: 'var(--color-primary, #3b82f6)', marginTop: 4, fontWeight: 600 }}>
                          💰 {item.modelGroup?.startsWith('image') ? (curModel.note || '') : formatCost(estCostPerPost(curModel))}
                        </div>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      {modelOpts ? (
                        <select
                          className="input-field"
                          value={settings[item.key] || ''}
                          onChange={e => update(item.key, e.target.value)}
                          style={{ fontSize: 14 }}
                        >
                          <option value="">— Mặc định —</option>
                          {modelOpts.map(m => (
                            <option key={m.id} value={m.id}>{m.label}{!item.modelGroup?.startsWith('image') ? ` (${formatCost(estCostPerPost(m))})` : (m.note ? ` (${m.note})` : '')}</option>
                          ))}
                        </select>
                      ) : item.selectOptions ? (
                        <select
                          className="input-field"
                          value={settings[item.key] || item.selectOptions[0]?.value || ''}
                          onChange={e => update(item.key, e.target.value)}
                          style={{ fontSize: 14 }}
                        >
                          {item.selectOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            type={item.secret && !shown ? 'password' : 'text'}
                            className="input-field"
                            placeholder={item.placeholder}
                            value={settings[item.key] || ''}
                            onChange={e => update(item.key, e.target.value)}
                            style={{ paddingRight: item.secret ? 38 : 14, fontFamily: item.secret ? 'var(--font-mono)' : undefined, fontSize: item.secret ? 13 : 15 }}
                          />
                          {item.secret && (
                            <button
                              type="button"
                              onClick={() => setReveal(r => ({ ...r, [item.key]: !r[item.key] }))}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)' }}
                            >
                              {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {hasTutorial && (
                    <details className="tutorial-block" style={{ marginTop: 10, marginLeft: 234, fontSize: 13 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--color-primary, #3b82f6)', fontWeight: 500, userSelect: 'none' }}>
                        📖 Hướng dẫn lấy key
                      </summary>
                      <div style={{ marginTop: 8, padding: 12, background: 'var(--color-surface-pearl, #f8fafc)', borderRadius: 8, lineHeight: 1.6 }}>
                        {item.signupUrl && (
                          <div style={{ marginBottom: 8 }}>
                            🔗 <a href={item.signupUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary, #3b82f6)', textDecoration: 'underline' }}>
                              {item.signupUrl}
                            </a>
                          </div>
                        )}
                        {item.steps?.length ? (
                          <ol style={{ marginLeft: 18, marginTop: 4 }}>
                            {item.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                          </ol>
                        ) : null}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>

          {section.title === 'TwinExpert (Twin Chat)' && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={validateTwin} disabled={validating || !settings.TWINEXPERT_API_KEY}>
                {validating ? 'Đang check...' : 'Validate + Usage'}
              </button>
              <button className="btn-primary" onClick={testTwin} disabled={twinTesting || !settings.TWINEXPERT_API_KEY}>
                {twinTesting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spinner" />Đang test...</span> : '🔬 Test gửi thử Twin'}
              </button>
              {twinValidation && (
                <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, color: twinValidation.valid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {twinValidation.valid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {twinValidation.valid ? 'Key hợp lệ' : (twinValidation.error || 'Invalid')}
                </span>
              )}
            </div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && twinTest && (
            <div className="card-pearl" style={{ marginTop: 8, padding: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: twinTest.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {twinTest.summary}
              </div>
              {(twinTest.steps || []).map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--color-divider-soft)' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: s.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>{s.ok ? '✓' : '✗'}</span>
                    <span style={{ fontWeight: 500, fontSize: 12 }}>{s.step}{s.status ? ` [${s.status}]` : ''}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-body-muted)', marginLeft: 18 }}>{s.detail}</div>
                  {s.raw && (
                    <details style={{ marginLeft: 18, marginTop: 2 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--color-body-muted)' }}>raw response</summary>
                      <code style={{ display: 'block', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 2 }}>{s.raw}</code>
                    </details>
                  )}
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--color-body-muted)', marginTop: 4 }}>
                💡 Nếu vẫn lỗi: copy phần này gửi dev để chỉnh parser cho khớp API.
              </div>
            </div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && settings.TWINEXPERT_TWIN_ID && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,149,0,0.1)', border: '1px solid var(--color-warning)', borderRadius: 8, fontSize: 13, color: 'var(--color-ink)' }}>
              💡 Twin ID KHÔNG bắt buộc — API tự lấy twin từ key. Có thể XOÁ trống để dùng twin mặc định, hoặc giữ nguyên nếu muốn ghi đè twin cụ thể.
            </div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && twins.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-body-muted)' }}>👇 Bấm chọn 1 Twin (sẽ set Default Twin ID):</div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && twinValidation?.usage && (
            <div className="card-pearl" style={{ marginTop: 8, fontSize: 13, padding: 12 }}>
              <div><b>Usage:</b></div>
              {twinValidation.usage.day_used !== undefined && <div>Hôm nay: {twinValidation.usage.day_used} / {twinValidation.usage.day_limit ?? '∞'}</div>}
              {twinValidation.usage.month_used !== undefined && <div>Tháng này: {twinValidation.usage.month_used} / {twinValidation.usage.month_limit ?? '∞'}</div>}
              {!twinValidation.usage.day_used && !twinValidation.usage.month_used && <div style={{ color: 'var(--color-body-muted)' }}>API không trả về thông tin usage chuẩn — dữ liệu raw: <code style={{ fontSize: 11 }}>{JSON.stringify(twinValidation.usage).slice(0, 200)}</code></div>}
            </div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && twins.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {twins.map((t: any) => {
                const tid = t.id || t._id || t.twin_id || t.twinId || '';
                const name = t.name || t.title || t.display_name || tid;
                const active = settings.TWINEXPERT_TWIN_ID === tid;
                return (
                  <div
                    key={tid}
                    onClick={() => update('TWINEXPERT_TWIN_ID', tid)}
                    className="card-pearl"
                    style={{ padding: 10, cursor: 'pointer', borderRadius: 11, border: active ? '2px solid var(--color-primary)' : '1px solid transparent' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-body-muted)', fontFamily: 'var(--font-mono)' }}>{tid}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
        </div>
      </div>

      <div className="settings-savebar">
        <button className="btn-primary" onClick={save} disabled={loading}>
          {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spinner" />Đang lưu...</span> : 'Lưu tất cả'}
        </button>
        {saveMsg && <span style={{ fontSize: 14, color: saveMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)' }}>{saveMsg}</span>}
      </div>
    </div>
  );
}
