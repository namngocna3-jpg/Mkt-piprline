import { sql } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { cleanText } from '@/lib/textClean';

export const maxDuration = 60;
export const runtime = 'nodejs';

const PROMPT = (title: string, body: string) =>
  `Tóm tắt tin sau thành 2-3 câu tiếng Việt DỄ ĐỌC, nêu rõ: chuyện gì + tại sao đáng chú ý. Không mở đầu kiểu "Bài viết nói về", đi thẳng vào nội dung. Không markdown.

TIÊU ĐỀ: ${title}
NỘI DUNG: ${body}`;

async function viaGemini(title: string, body: string): Promise<string | null> {
  const key = await getSetting('GEMINI_API_KEY');
  if (!key) return null;
  const model = (await getSetting('GEMINI_MODEL')) || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT(title, body) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim() || null;
}

async function viaOpenAI(title: string, body: string): Promise<string | null> {
  const key = await getSetting('OPENAI_API_KEY');
  if (!key) return null;
  const model = (await getSetting('OPENAI_MODEL')) || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT(title, body) }], temperature: 0.3, max_tokens: 200 }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content || '').trim() || null;
}

async function viaAnthropic(title: string, body: string): Promise<string | null> {
  const key = await getSetting('ANTHROPIC_API_KEY');
  if (!key) return null;
  const model = (await getSetting('ANTHROPIC_MODEL')) || 'claude-haiku-4-5-20251001';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 250, messages: [{ role: 'user', content: PROMPT(title, body) }] }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.content?.[0]?.text || '').trim() || null;
}

export async function POST(req: Request) {
  try {
    const { articleId } = await req.json();
    if (!articleId) return Response.json({ error: 'Thiếu articleId' }, { status: 400 });

    const [article] = await sql`SELECT id, title, summary, ai_summary FROM articles WHERE id = ${articleId}`;
    if (!article) return Response.json({ error: 'Không tìm thấy bài' }, { status: 404 });
    if (article.ai_summary) return Response.json({ summary: article.ai_summary, cached: true });

    const title = cleanText(article.title);
    const body = cleanText(article.summary).slice(0, 2000);

    let summary: string | null = null;
    for (const fn of [viaGemini, viaOpenAI, viaAnthropic]) {
      try { summary = await fn(title, body); if (summary) break; } catch { /* next */ }
    }
    if (!summary) {
      return Response.json({ error: 'Chưa cấu hình AI key nào (Gemini/OpenAI/Anthropic). Vào /settings.' }, { status: 400 });
    }

    summary = cleanText(summary);
    await sql`UPDATE articles SET ai_summary = ${summary} WHERE id = ${articleId}`;
    return Response.json({ summary });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
