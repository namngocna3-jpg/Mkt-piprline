import { listOpenAIModels } from '@/lib/ai/image-generator';
import { listGeminiTextModels } from '@/lib/ai/gemini-models';
import { getSetting } from '@/lib/settings';

export const runtime = 'nodejs';

// Trả về model TEXT khả dụng cho key OpenAI + Gemini (hỏi thẳng /v1/models của provider).
// Lọc về model chat (bỏ embedding/tts/audio/image/vision-only...).
export async function GET() {
  const [oaKey, gmKey] = await Promise.all([
    getSetting('OPENAI_API_KEY'),
    getSetting('GEMINI_API_KEY'),
  ]);

  const out: any = { openai: { ok: false, ids: [] as string[] }, gemini: { ok: false, ids: [] as string[] } };

  if (oaKey) {
    const r = await listOpenAIModels(oaKey);
    out.openai = {
      ok: r.ok,
      error: r.error,
      ids: (r.ids || [])
        .filter(id => /^(gpt-|o\d|chatgpt)/i.test(id))
        .filter(id => !/audio|realtime|transcribe|tts|image|embedding|moderation|search|instruct-0914/i.test(id))
        .sort(),
    };
  }

  if (gmKey) {
    const ids = await listGeminiTextModels(gmKey);
    out.gemini = { ok: ids.length > 0, ids: ids.sort() };
  }

  return Response.json(out);
}
