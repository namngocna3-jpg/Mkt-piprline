import { listOpenAIModels, listGeminiModels } from '@/lib/ai/image-generator';
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
    const r = await listGeminiModels(gmKey);
    out.gemini = {
      ok: r.ok,
      error: r.error,
      ids: (r.ids || [])
        .filter(id => /gemini/i.test(id))
        .filter(id => !/embedding|aqa|imagen|tts|image/i.test(id))
        .sort(),
    };
  }

  return Response.json(out);
}
