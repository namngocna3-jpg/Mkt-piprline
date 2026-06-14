import { getAllSettings } from '@/lib/settings';
import { listOpenAIModels, listGeminiModels } from '@/lib/ai/image-generator';

export const maxDuration = 60;
export const runtime = 'nodejs';

type Result = {
  id: string;
  label: string;
  category: 'db' | 'ai' | 'image' | 'search' | 'vision' | 'rapid' | 'social';
  status: 'ok' | 'fail' | 'skip' | 'warn';
  detail: string;
  models?: string[]; // model khả dụng (cho ảnh)
  fix?: string[];    // cách sửa nếu fail
};

async function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T | { __timeout: true }> {
  return Promise.race([p, new Promise<{ __timeout: true }>((r) => setTimeout(() => r({ __timeout: true }), ms))]) as any;
}

async function testFetch(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    return { ok: false, status: 0, text: e?.message || String(e) };
  }
}

export async function GET() {
  const s = await getAllSettings();
  const has = (k: string) => !!(s[k] && String(s[k]).trim());
  const results: Result[] = [];

  // ===== Database =====
  try {
    const db = await fetch(new URL('/api/db-test', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000').toString(), { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (db) {
      results.push({
        id: 'db', label: '📡 Database (Supabase)', category: 'db',
        status: db.ok ? 'ok' : 'fail',
        detail: db.message || (db.ok ? 'Kết nối OK' : 'Không kết nối được'),
        fix: db.hints,
      });
    }
  } catch { /* skip */ }

  // ===== AI Viết bài =====
  // Anthropic
  if (has('ANTHROPIC_API_KEY')) {
    const r = await testFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': s.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: s.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
    });
    results.push({
      id: 'claude', label: '🧠 Anthropic Claude', category: 'ai',
      status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? `Model "${s.ANTHROPIC_MODEL || 'haiku-4.5'}" trả lời OK` : `HTTP ${r.status}: ${r.text.slice(0, 200)}`,
      fix: !r.ok ? [
        r.status === 401 ? 'Key sai/hết hạn → tạo mới ở console.anthropic.com/settings/keys' : '',
        r.status === 400 && /model/i.test(r.text) ? `Model "${s.ANTHROPIC_MODEL}" không tồn tại. Đổi sang claude-haiku-4-5-20251001 hoặc claude-sonnet-4-6.` : '',
        r.status === 429 ? 'Hết quota — đợi reset hoặc nâng plan.' : '',
        r.text.includes('credit') ? 'Hết credit — nạp tiền ở console.anthropic.com/settings/billing' : '',
      ].filter(Boolean) : undefined,
    });
  } else results.push({ id: 'claude', label: '🧠 Anthropic Claude', category: 'ai', status: 'skip', detail: 'Chưa cấu hình key' });

  // OpenAI
  if (has('OPENAI_API_KEY')) {
    const r = await testFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: s.OPENAI_MODEL || 'gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
    });
    results.push({
      id: 'openai', label: '🟢 OpenAI (text)', category: 'ai',
      status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? `Model "${s.OPENAI_MODEL || 'gpt-4o-mini'}" OK` : `HTTP ${r.status}: ${r.text.slice(0, 200)}`,
      fix: !r.ok ? [
        r.status === 401 ? 'Key sai → platform.openai.com/api-keys tạo lại' : '',
        /model.*not.*exist|model_not_found/i.test(r.text) ? `Model "${s.OPENAI_MODEL}" không khả dụng cho key này. Đổi sang gpt-4o-mini hoặc gpt-4o.` : '',
        /insufficient_quota|billing/i.test(r.text) ? 'Hết quota/chưa nạp tiền → platform.openai.com/settings/organization/billing' : '',
      ].filter(Boolean) : undefined,
    });
  } else results.push({ id: 'openai', label: '🟢 OpenAI (text)', category: 'ai', status: 'skip', detail: 'Chưa cấu hình key' });

  // Gemini
  if (has('GEMINI_API_KEY')) {
    const model = s.GEMINI_MODEL || 'gemini-2.0-flash';
    const r = await testFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${s.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 5 } }),
    });
    results.push({
      id: 'gemini', label: '🔷 Google Gemini', category: 'ai',
      status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? `Model "${model}" OK (FREE tier nếu là gemini-2.0-flash)` : `HTTP ${r.status}: ${r.text.slice(0, 200)}`,
      fix: !r.ok ? [
        r.status === 400 && /API key not valid/i.test(r.text) ? 'Key sai → aistudio.google.com/apikey tạo lại' : '',
        r.status === 404 ? `Model "${model}" không tồn tại. Đổi sang gemini-2.0-flash (FREE).` : '',
        r.status === 429 ? 'Hết quota — đợi reset hoặc nâng plan trả phí.' : '',
      ].filter(Boolean) : undefined,
    });
  } else results.push({ id: 'gemini', label: '🔷 Google Gemini', category: 'ai', status: 'skip', detail: 'Chưa cấu hình key (KHUYÊN: FREE tier rất hào phóng)' });

  // TwinExpert
  if (has('TWINEXPERT_API_KEY')) {
    const r = await testFetch('https://api.twinexpert.com/api/v1/auth/validate', {
      headers: { Authorization: `Bearer ${s.TWINEXPERT_API_KEY}` },
    });
    results.push({
      id: 'twinexpert', label: '🪞 TwinExpert', category: 'ai',
      status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'Key hợp lệ (twin auto theo key)' : `HTTP ${r.status}: ${r.text.slice(0, 200)}`,
      fix: !r.ok ? [
        /Invalid API key format/i.test(r.text) ? 'Key sai định dạng — phải dạng ak_... tạo ở twinexpert.com/profile/api-keys' : '',
        r.status === 401 ? 'Key hết hạn → tạo mới' : '',
      ].filter(Boolean) : undefined,
    });
  } else results.push({ id: 'twinexpert', label: '🪞 TwinExpert', category: 'ai', status: 'skip', detail: 'Chưa cấu hình key' });

  // ===== Tạo ảnh — list model khả dụng =====
  if (has('OPENAI_API_KEY')) {
    const r = await listOpenAIModels(s.OPENAI_API_KEY);
    if (r.ok) {
      const imageModels = ['gpt-image-1', 'dall-e-3', 'dall-e-2'].filter(m => r.ids.includes(m));
      results.push({
        id: 'image_openai', label: '🎨 Tạo ảnh OpenAI', category: 'image',
        status: imageModels.length ? 'ok' : 'fail',
        detail: imageModels.length ? `Khả dụng: ${imageModels.join(', ')}` : 'Key OpenAI hợp lệ nhưng KHÔNG có model ảnh nào',
        models: imageModels,
        fix: !imageModels.length ? [
          'Key OpenAI hiện không có quyền model ảnh.',
          'Cần nạp credit tối thiểu $5 tại platform.openai.com/settings/organization/billing',
          'Một số tổ chức cần "Verify Organization" ở platform.openai.com/settings/organization/general để dùng gpt-image-1.',
          'Sau đó các model sẽ hiện trong /v1/models.',
        ] : undefined,
      });
    } else {
      results.push({ id: 'image_openai', label: '🎨 Tạo ảnh OpenAI', category: 'image', status: 'fail', detail: `Không list được models: ${r.error}` });
    }
  } else results.push({ id: 'image_openai', label: '🎨 Tạo ảnh OpenAI', category: 'image', status: 'skip', detail: 'Chưa có OPENAI_API_KEY' });

  if (has('GEMINI_API_KEY')) {
    const r = await listGeminiModels(s.GEMINI_API_KEY);
    if (r.ok) {
      const imageModels = ['imagen-4.0-generate-001', 'imagen-3.0-generate-002', 'imagen-3.0-generate-001'].filter(m => r.ids.includes(m));
      results.push({
        id: 'image_gemini', label: '🎨 Tạo ảnh Gemini (Imagen)', category: 'image',
        status: imageModels.length ? 'ok' : 'warn',
        detail: imageModels.length ? `Khả dụng: ${imageModels.join(', ')}` : 'Imagen KHÔNG liệt kê — Imagen thường cần bật billing Google Cloud',
        models: imageModels,
        fix: !imageModels.length ? [
          'Imagen yêu cầu bật billing Google Cloud + enable Vertex AI API.',
          'Vào console.cloud.google.com → APIs & Services → Library → tìm "Vertex AI API" → Enable + link billing account.',
          'Sau đó key Gemini cùng project sẽ truy cập Imagen được.',
        ] : undefined,
      });
    }
  } else results.push({ id: 'image_gemini', label: '🎨 Tạo ảnh Gemini', category: 'image', status: 'skip', detail: 'Chưa có GEMINI_API_KEY' });

  // ===== Search =====
  if (has('BRAVE_API_KEY')) {
    const r = await testFetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
      headers: { 'X-Subscription-Token': s.BRAVE_API_KEY, Accept: 'application/json' },
    });
    results.push({ id: 'brave', label: '🦁 Brave Search', category: 'search', status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'Search OK' : `HTTP ${r.status}: ${r.text.slice(0, 150)}`,
      fix: !r.ok ? [r.status === 422 ? 'Chưa subscribe Free plan tại api.search.brave.com/app/subscriptions' : ''].filter(Boolean) : undefined,
    });
  } else results.push({ id: 'brave', label: '🦁 Brave Search', category: 'search', status: 'skip', detail: '(optional) 2000 query/tháng FREE' });

  if (has('TAVILY_API_KEY')) {
    const r = await testFetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: s.TAVILY_API_KEY, query: 'test', max_results: 1 }),
    });
    results.push({ id: 'tavily', label: '🔍 Tavily', category: 'search', status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'Search OK' : `HTTP ${r.status}: ${r.text.slice(0, 150)}` });
  } else results.push({ id: 'tavily', label: '🔍 Tavily', category: 'search', status: 'skip', detail: '(optional) 1000 query/tháng FREE' });

  if (has('SERPAPI_API_KEY')) {
    const r = await testFetch(`https://serpapi.com/search.json?q=test&api_key=${s.SERPAPI_API_KEY}&num=1`, {});
    results.push({ id: 'serpapi', label: '🔍 SerpAPI', category: 'search', status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'Search OK' : `HTTP ${r.status}: ${r.text.slice(0, 150)}` });
  } else results.push({ id: 'serpapi', label: '🔍 SerpAPI', category: 'search', status: 'skip', detail: '(optional) 100 query/tháng FREE' });

  // ===== Vision providers =====
  if (has('GROQ_API_KEY')) {
    const r = await testFetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${s.GROQ_API_KEY}` } });
    results.push({ id: 'groq', label: '⚡ Groq (Vision)', category: 'vision', status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'Key OK — FREE tier 30 RPM' : `HTTP ${r.status}: ${r.text.slice(0, 150)}` });
  } else results.push({ id: 'groq', label: '⚡ Groq', category: 'vision', status: 'skip', detail: '(optional) FREE 30 RPM cho Vision' });

  if (has('OPENROUTER_API_KEY')) {
    const r = await testFetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${s.OPENROUTER_API_KEY}` } });
    results.push({ id: 'openrouter', label: '🛣️ OpenRouter', category: 'vision', status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'Key OK — có model :free' : `HTTP ${r.status}: ${r.text.slice(0, 150)}` });
  } else results.push({ id: 'openrouter', label: '🛣️ OpenRouter', category: 'vision', status: 'skip', detail: '(optional) model :free 100% FREE' });

  // ===== RapidAPI hub =====
  if (has('RAPID_API_KEY')) {
    // Test bằng cách gọi 1 endpoint phổ biến — chấp nhận 401/403 là key sai, 200/404 là key OK (đến server hub)
    const r = await testFetch('https://twitter-api47.p.rapidapi.com/v3/search?query=test&type=Top', {
      headers: { 'x-rapidapi-host': 'twitter-api47.p.rapidapi.com', 'x-rapidapi-key': s.RAPID_API_KEY },
    });
    const keyOK = r.status !== 401 && r.status !== 403;
    const subscribed = r.ok || (r.status >= 200 && r.status < 500 && !/not subscribed/i.test(r.text));
    results.push({ id: 'rapid', label: '🚀 RapidAPI (X scraper)', category: 'rapid',
      status: r.ok ? 'ok' : (keyOK ? 'warn' : 'fail'),
      detail: r.ok ? 'X (Twitter API47) chạy được' : keyOK ? 'Key hợp lệ nhưng CHƯA subscribe API này' : `HTTP ${r.status}: ${r.text.slice(0, 150)}`,
      fix: !subscribed ? [
        'Vào rapidapi.com/davethebeast/api/twitter-api47 → Subscribe (Basic FREE 100 req/mo)',
        'Mỗi scraper RapidAPI cần Subscribe RIÊNG (X / IG / TikTok / YouTube).',
      ] : undefined,
    });
  } else results.push({ id: 'rapid', label: '🚀 RapidAPI', category: 'rapid', status: 'skip', detail: '(optional) cào X/IG/TikTok' });

  if (has('YOUTUBE_API_KEY')) {
    const r = await testFetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${s.YOUTUBE_API_KEY}`, {});
    results.push({ id: 'youtube', label: '▶️ YouTube Data API', category: 'rapid', status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? 'OK — FREE 10000 units/ngày' : `HTTP ${r.status}: ${r.text.slice(0, 150)}` });
  } else results.push({ id: 'youtube', label: '▶️ YouTube', category: 'rapid', status: 'skip', detail: '(optional) FREE 10000 units/ngày' });

  // Tổng kết
  const ok = results.filter(r => r.status === 'ok').length;
  const fail = results.filter(r => r.status === 'fail').length;
  const skip = results.filter(r => r.status === 'skip').length;
  const warn = results.filter(r => r.status === 'warn').length;

  return Response.json({ ok, fail, skip, warn, results });
}
