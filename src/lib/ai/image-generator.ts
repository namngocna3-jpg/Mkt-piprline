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
  const provider = opts?.provider || (await getSetting('IMAGE_PROVIDER')) || 'openai';
  const model = opts?.model || (await getSetting('IMAGE_MODEL')) || (provider === 'gemini' ? 'imagen-3.0-generate-002' : 'dall-e-3');
  if (provider === 'gemini') return generateWithGemini(topic, model);
  return generateWithOpenAI(topic, model);
}

async function generateWithOpenAI(topic: string, model: string): Promise<string | null> {
  const apiKey = await getSetting('OPENAI_API_KEY');
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const imagePrompt = `Create an illustration for a social media post about: "${topic}".
STYLE: Cinematic concept art or Ghibli-inspired painterly illustration.
COMPOSITION: Square image (1:1).
REQUIREMENTS: Very little to no text, absolutely no charts, graphs, bullet points, or icons. The scene must visually capture the core essence of the topic in an epic, professional, and visually stunning way.`;
    const params: any = {
      model,
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    };
    // dall-e-3 hỗ trợ quality; dall-e-2 / gpt-image-1 thì không cùng schema
    if (model === 'dall-e-3') params.quality = 'standard';
    const imgRes = await openai.images.generate(params);
    const imgData = imgRes.data?.[0];
    // gpt-image-1 trả base64, dall-e trả url
    if (imgData?.b64_json) return `data:image/png;base64,${imgData.b64_json}`;
    return imgData?.url || null;
  } catch (error) {
    console.error(`OpenAI image (${model}) error:`, error);
    return null;
  }
}

async function generateWithGemini(topic: string, model: string): Promise<string | null> {
  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) return null;
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
    if (!res.ok) return null;
    const json = await res.json();
    const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch (error) {
    console.error(`Gemini image (${model}) error:`, error);
    return null;
  }
}
