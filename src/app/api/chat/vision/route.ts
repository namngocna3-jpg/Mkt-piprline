import { getSetting } from '@/lib/settings';
import { describeImageWithGemini } from '@/lib/geminiClient';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { dataUrl, prompt } = await req.json();
    if (!dataUrl || typeof dataUrl !== 'string') {
      return Response.json({ error: 'Thiếu dataUrl' }, { status: 400 });
    }
    const apiKey = await getSetting('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response('Chưa cấu hình GEMINI_API_KEY', { status: 400 });
    }
    const text = await describeImageWithGemini(apiKey, dataUrl, prompt);
    return Response.json({ text });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
