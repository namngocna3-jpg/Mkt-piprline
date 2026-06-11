import OpenAI from 'openai';
import { getSetting } from '../settings';

export type ImageOptions = { provider?: string; model?: string };

// Danh sách model ảnh cho UI chọn
export const IMAGE_MODELS: { provider: string; model: string; label: string; note: string }[] = [
  { provider: 'openai', model: 'dall-e-3', label: 'DALL·E 3', note: 'Chất lượng cao, ~$0.04/ảnh' },
  { provider: 'openai', model: 'gpt-image-1', label: 'GPT Image 1', note: 'Model ảnh mới của OpenAI' },
  { provider: 'openai', model: 'dall-e-2', label: 'DALL·E 2', note: 'Rẻ hơn, ~$0.02/ảnh' },
  { provider: 'gemini', model: 'imagen-4.0-generate-001', label: 'Imagen 4', note: 'Google, mới nhất' },
  { provider: 'gemini', model: 'imagen-3.0-generate-002', label: 'Imagen 3', note: 'Google, ổn định' },
];

export async function generateImageResponse(topic: string, opts?: ImageOptions): Promise<string | null> {
  const r = await generateImageDetailed(topic, opts);
  return r.url;
}

// Bản chi tiết: trả cả lý do lỗi để UI báo cho user (vì sao không ra ảnh).
export async function generateImageDetailed(topic: string, opts?: ImageOptions): Promise<{ url: string | null; error?: string }> {
  const provider = opts?.provider || (await getSetting('IMAGE_PROVIDER')) || 'openai';
  const model = opts?.model || (await getSetting('IMAGE_MODEL')) || (provider === 'gemini' ? 'imagen-3.0-generate-002' : 'dall-e-3');
  const key = provider === 'gemini' ? await getSetting('GEMINI_API_KEY') : await getSetting('OPENAI_API_KEY');
  if (!key) return { url: null, error: `Chưa có ${provider === 'gemini' ? 'GEMINI' : 'OPENAI'}_API_KEY (mục AI Viết bài).` };
  if (provider === 'gemini') return generateWithGemini(topic, model, key);
  return generateWithOpenAI(topic, model, key);
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
