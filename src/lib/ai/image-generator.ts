import OpenAI from 'openai';
import { getSetting } from '../settings';

export async function generateImageResponse(topic: string): Promise<string | null> {
  const provider = (await getSetting('IMAGE_PROVIDER')) || 'openai';
  if (provider === 'gemini') return generateWithGemini(topic);
  return generateWithOpenAI(topic);
}

async function generateWithOpenAI(topic: string): Promise<string | null> {
  const apiKey = await getSetting('OPENAI_API_KEY');
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const imagePrompt = `Create an illustration for a social media post about: "${topic}".
STYLE: Cinematic concept art or Ghibli-inspired painterly illustration.
COMPOSITION: Square image (1:1).
REQUIREMENTS: Very little to no text, absolutely no charts, graphs, bullet points, or icons. The scene must visually capture the core essence of the topic in an epic, professional, and visually stunning way.`;
    const imgRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });
    const imgData = imgRes.data?.[0];
    return imgData?.url || null;
  } catch (error) {
    console.error('OpenAI image generation error:', error);
    return null;
  }
}

async function generateWithGemini(topic: string): Promise<string | null> {
  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) return null;
  try {
    const model = 'imagen-3.0-generate-002';
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
    console.error('Gemini image generation error:', error);
    return null;
  }
}
