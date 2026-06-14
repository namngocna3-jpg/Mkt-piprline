import OpenAI from 'openai';
import { getSetting } from '../settings';

export type ImageOptions = { provider?: string; model?: string };

// Danh sách model ảnh cho UI chọn
export const IMAGE_MODELS: { provider: string; model: string; label: string; note: string }[] = [
  { provider: 'openai', model: 'gpt-image-1', label: 'GPT Image 1', note: 'Model ảnh mới của OpenAI' },
  { provider: 'openai', model: 'dall-e-3', label: 'DALL·E 3', note: 'Chất lượng cao, ~$0.04/ảnh' },
  { provider: 'openai', model: 'dall-e-2', label: 'DALL·E 2', note: 'Rẻ hơn, ~$0.02/ảnh' },
  { provider: 'gemini', model: 'imagen-4.0-generate-001', label: 'Imagen 4', note: 'Google, mới nhất' },
  { provider: 'gemini', model: 'imagen-3.0-generate-002', label: 'Imagen 3', note: 'Google, ổn định' },
];

const OPENAI_IMAGE_CANDIDATES = ['gpt-image-1', 'dall-e-3', 'dall-e-2'];
const GEMINI_IMAGE_CANDIDATES = ['imagen-4.0-generate-001', 'imagen-3.0-generate-002', 'imagen-3.0-generate-001'];

// ===== Discovery: hỏi server model nào key THỰC SỰ có quyền =====
export async function listOpenAIModels(apiKey: string): Promise<{ ok: boolean; ids: string[]; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, ids: [], error: `${res.status}: ${t.slice(0, 140)}` };
    }
    const json = await res.json();
    const ids = (json?.data || []).map((m: any) => m.id).filter(Boolean);
    return { ok: true, ids };
  } catch (e: any) {
    return { ok: false, ids: [], error: e?.message || String(e) };
  }
}

export async function listGeminiModels(apiKey: string): Promise<{ ok: boolean; ids: string[]; error?: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`);
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, ids: [], error: `${res.status}: ${t.slice(0, 140)}` };
    }
    const json = await res.json();
    const ids = (json?.models || []).map((m: any) => String(m.name || '').replace(/^models\//, '')).filter(Boolean);
    return { ok: true, ids };
  } catch (e: any) {
    return { ok: false, ids: [], error: e?.message || String(e) };
  }
}

// Model ảnh KHẢ DỤNG cho key (giao của candidates và model server trả về)
export async function availableImageModels(provider: string): Promise<{ ok: boolean; models: string[]; error?: string }> {
  if (provider === 'gemini') {
    const key = await getSetting('GEMINI_API_KEY');
    if (!key) return { ok: false, models: [], error: 'Chưa có GEMINI_API_KEY' };
    const r = await listGeminiModels(key);
    if (!r.ok) return { ok: false, models: [], error: r.error };
    // Imagen có thể không liệt kê với key free → vẫn trả candidates để thử
    const found = GEMINI_IMAGE_CANDIDATES.filter(m => r.ids.includes(m));
    return { ok: true, models: found.length ? found : GEMINI_IMAGE_CANDIDATES };
  }
  const key = await getSetting('OPENAI_API_KEY');
  if (!key) return { ok: false, models: [], error: 'Chưa có OPENAI_API_KEY' };
  const r = await listOpenAIModels(key);
  if (!r.ok) return { ok: false, models: [], error: r.error };
  const found = OPENAI_IMAGE_CANDIDATES.filter(m => r.ids.includes(m));
  return { ok: true, models: found };
}

export async function generateImageResponse(topic: string, opts?: ImageOptions): Promise<string | null> {
  const r = await generateImageDetailed(topic, opts);
  return r.url;
}

// Tạo ảnh: hỏi server model khả dụng TRƯỚC rồi chỉ thử model đó (tránh "model does not exist").
export async function generateImageDetailed(topic: string, opts?: ImageOptions): Promise<{ url: string | null; error?: string; modelUsed?: string }> {
  const provider = opts?.provider || (await getSetting('IMAGE_PROVIDER')) || 'openai';
  const chosen = opts?.model || (await getSetting('IMAGE_MODEL')) || '';
  const key = provider === 'gemini' ? await getSetting('GEMINI_API_KEY') : await getSetting('OPENAI_API_KEY');
  if (!key) return { url: null, error: `Chưa có ${provider === 'gemini' ? 'GEMINI' : 'OPENAI'}_API_KEY (mục AI Viết bài).` };

  // Lấy danh sách model khả dụng từ server
  const avail = await availableImageModels(provider);
  let chain: string[];
  if (avail.ok && avail.models.length) {
    // Ưu tiên model user chọn (nếu khả dụng), rồi phần còn lại
    chain = [chosen, ...avail.models].filter((m, i, a) => m && a.indexOf(m) === i && avail.models.includes(m));
    if (!chain.length) chain = avail.models;
  } else if (avail.ok && provider === 'openai' && !avail.models.length) {
    // Key OpenAI hợp lệ nhưng KHÔNG có model ảnh nào
    return { url: null, error: 'Key OpenAI KHÔNG có quyền model tạo ảnh nào (gpt-image-1/dall-e-3/dall-e-2). Cần nạp credit hoặc xác minh tổ chức tại platform.openai.com.' };
  } else {
    // Không liệt kê được → thử blind theo candidates
    chain = provider === 'gemini' ? GEMINI_IMAGE_CANDIDATES : OPENAI_IMAGE_CANDIDATES;
    if (chosen) chain = [chosen, ...chain].filter((m, i, a) => a.indexOf(m) === i);
  }

  const errors: string[] = [];
  for (const m of chain) {
    const r = provider === 'gemini'
      ? await generateWithGemini(topic, m, key)
      : await generateWithOpenAI(topic, m, key);
    if (r.url) return { url: r.url, modelUsed: m };
    if (r.error) errors.push(`${m}: ${r.error}`);
    if (r.error && /quota|billing|insufficient|exceeded/i.test(r.error)) break;
  }
  return { url: null, error: errors.join(' | ').slice(0, 400) || 'Không tạo được ảnh.' };
}

async function generateWithOpenAI(topic: string, model: string, apiKey: string): Promise<{ url: string | null; error?: string }> {
  try {
    const openai = new OpenAI({ apiKey });
    const imagePrompt = `Create an illustration for a social media post about: "${topic}".
STYLE: Cinematic concept art or Ghibli-inspired painterly illustration.
COMPOSITION: Square image (1:1).
REQUIREMENTS: Very little to no text, absolutely no charts, graphs, bullet points, or icons. The scene must visually capture the core essence of the topic in an epic, professional, and visually stunning way.`;
    const params: any = { model, prompt: imagePrompt, n: 1, size: '1024x1024' };
    if (model === 'dall-e-3') params.quality = 'standard';
    const imgRes = await openai.images.generate(params);
    const imgData = imgRes.data?.[0];
    if (imgData?.b64_json) return { url: `data:image/png;base64,${imgData.b64_json}` };
    if (imgData?.url) return { url: imgData.url };
    return { url: null, error: 'OpenAI không trả ảnh.' };
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error(`OpenAI image (${model}) error:`, msg);
    return { url: null, error: `OpenAI: ${msg.slice(0, 160)}` };
  }
}

async function generateWithGemini(topic: string, model: string, apiKey: string): Promise<{ url: string | null; error?: string }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: `Cinematic concept art illustration about: "${topic}". Square 1:1. No text, no charts. Epic, professional, painterly style.` }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { url: null, error: `Gemini ${res.status}: ${t.slice(0, 160)}` };
    }
    const json = await res.json();
    const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return { url: null, error: 'Gemini không trả ảnh (Imagen cần tài khoản trả phí/được cấp quyền).' };
    return { url: `data:image/png;base64,${b64}` };
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error(`Gemini image (${model}) error:`, msg);
    return { url: null, error: `Gemini: ${msg.slice(0, 160)}` };
  }
}
