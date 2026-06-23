import { getSetting } from '@/lib/settings';
import { pickGeminiModel } from '@/lib/ai/gemini-models';

export const maxDuration = 30;
export const runtime = 'nodejs';

const PROMPT = 'Tóm tắt cuộc hội thoại sau thành tiêu đề ngắn gọn TỐI ĐA 6 TỪ tiếng Việt, không dấu chấm, không quote, không emoji. Chỉ trả về tiêu đề.';

function buildContext(userQ: string, aiA: string) {
  const u = (userQ || '').slice(0, 600);
  const a = (aiA || '').slice(0, 600);
  return `USER: ${u}\n\nASSISTANT: ${a}\n\n---\n${PROMPT}`;
}

function cleanTitle(raw: string): string {
  return (raw || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。!?…]+$/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')
    .slice(0, 80);
}

async function tryGemini(userQ: string, aiA: string): Promise<string | null> {
  const key = await getSetting('GEMINI_API_KEY');
  if (!key) return null;
  const model = await pickGeminiModel(await getSetting('GEMINI_MODEL'));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildContext(userQ, aiA) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 40 },
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const t = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return t.trim() || null;
}

async function tryOpenAI(userQ: string, aiA: string): Promise<string | null> {
  const key = await getSetting('OPENAI_API_KEY');
  if (!key) return null;
  const model = (await getSetting('OPENAI_MODEL')) || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildContext(userQ, aiA) }],
      temperature: 0.2,
      max_tokens: 40,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content || '').trim() || null;
}

async function tryAnthropic(userQ: string, aiA: string): Promise<string | null> {
  const key = await getSetting('ANTHROPIC_API_KEY');
  if (!key) return null;
  const model = (await getSetting('ANTHROPIC_MODEL')) || 'claude-haiku-4-5-20251001';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 60,
      messages: [{ role: 'user', content: buildContext(userQ, aiA) }],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.content?.[0]?.text || '').trim() || null;
}

export async function POST(req: Request) {
  try {
    const { userQuestion, aiAnswer } = await req.json();
    const userQ = String(userQuestion || '').trim();
    const aiA = String(aiAnswer || '').trim();
    if (!userQ) return Response.json({ title: 'Chat mới' });

    for (const tryFn of [tryGemini, tryOpenAI, tryAnthropic]) {
      try {
        const raw = await tryFn(userQ, aiA);
        const title = raw && cleanTitle(raw);
        if (title && title.length >= 3) return Response.json({ title, source: tryFn.name });
      } catch { /* try next provider */ }
    }

    // Fallback: use first ~60 chars of user question
    return Response.json({ title: userQ.replace(/\s+/g, ' ').slice(0, 60), source: 'fallback' });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
