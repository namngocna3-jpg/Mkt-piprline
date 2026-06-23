import { getSetting } from './settings';
import { pickGeminiModel } from './ai/gemini-models';

export type VisionResult = { text: string; provider: string };

const DEFAULT_PROMPT =
  'Mô tả ảnh này chi tiết bằng tiếng Việt. Trích xuất text/biểu đồ/đối tượng quan trọng để AI khác có thể hiểu nội dung.';

function parseDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error('Không nhận diện được data URL ảnh');
  return { mime: m[1], base64: m[2] };
}

function isRateLimited(status: number) {
  return status === 429 || status === 403 || status === 503;
}

async function geminiVision(apiKey: string, dataUrl: string, prompt: string, model: string): Promise<string> {
  const { mime, base64 } = parseDataUrl(dataUrl);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: prompt }] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 160)}`);
  }
  const json = await res.json();
  return (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function groqVision(apiKey: string, dataUrl: string, prompt: string): Promise<string> {
  const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`Groq ${res.status}: ${t.slice(0, 160)}`);
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content || '').trim();
}

async function openrouterVision(apiKey: string, dataUrl: string, prompt: string, model: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/namngocna3-jpg/Mkt-piprline',
      'X-Title': 'Mkt-piprline',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 160)}`);
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content || '').trim();
}

async function hfVision(apiKey: string, dataUrl: string, prompt: string): Promise<string> {
  const { mime, base64 } = parseDataUrl(dataUrl);
  // Try LLaVA 1.5 hosted on HF Inference
  const buf = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([buf], { type: mime });
  const fd = new FormData();
  fd.append('image', blob, 'image.png');
  fd.append('inputs', JSON.stringify({ image: `data:${mime};base64,${base64}`, text: prompt }));
  const res = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: buf,
  });
  if (!res.ok) {
    const t = await res.text();
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`HF ${res.status}: ${t.slice(0, 160)}`);
  }
  const json = await res.json();
  const caption = Array.isArray(json) ? json[0]?.generated_text : json?.generated_text;
  return String(caption || '').trim();
}

export async function describeImage(dataUrl: string, prompt = DEFAULT_PROMPT): Promise<VisionResult> {
  const errors: string[] = [];

  const geminiKey = await getSetting('GEMINI_API_KEY');
  if (geminiKey) {
    const model = await pickGeminiModel(await getSetting('GEMINI_MODEL'));
    try {
      const text = await geminiVision(geminiKey, dataUrl, prompt, model);
      if (text) return { text, provider: 'gemini' };
    } catch (e: any) { errors.push(`gemini: ${e?.message || e}`); }
  }

  const groqKey = await getSetting('GROQ_API_KEY');
  if (groqKey) {
    try {
      const text = await groqVision(groqKey, dataUrl, prompt);
      if (text) return { text, provider: 'groq' };
    } catch (e: any) { errors.push(`groq: ${e?.message || e}`); }
  }

  const orKey = await getSetting('OPENROUTER_API_KEY');
  if (orKey) {
    const model = (await getSetting('OPENROUTER_VISION_MODEL')) || 'google/gemini-2.0-flash-exp:free';
    try {
      const text = await openrouterVision(orKey, dataUrl, prompt, model);
      if (text) return { text, provider: 'openrouter' };
    } catch (e: any) {
      errors.push(`openrouter: ${e?.message || e}`);
      // Try a second free model if the first fails
      try {
        const text = await openrouterVision(orKey, dataUrl, prompt, 'meta-llama/llama-3.2-11b-vision-instruct:free');
        if (text) return { text, provider: 'openrouter-llama-vision' };
      } catch (e2: any) { errors.push(`openrouter-llama: ${e2?.message || e2}`); }
    }
  }

  const hfKey = await getSetting('HUGGINGFACE_API_KEY');
  if (hfKey) {
    try {
      const text = await hfVision(hfKey, dataUrl, prompt);
      if (text) return { text, provider: 'huggingface' };
    } catch (e: any) { errors.push(`hf: ${e?.message || e}`); }
  }

  if (errors.length === 0) {
    throw new Error('NO_PROVIDER:Chưa cấu hình bất kỳ Vision provider nào (GEMINI/GROQ/OPENROUTER/HUGGINGFACE)');
  }
  throw new Error(`ALL_FAILED:${errors.join(' | ')}`);
}
