import { getSetting } from '../settings';
import { pickGeminiModel } from './gemini-models';
import { cleanText } from '../textClean';

export type Idea = { title: string; summary: string };

function buildPrompt(topic: string, count: number) {
  return `Bạn là chuyên gia content marketing. Cho chủ đề: "${topic}".
Đề xuất ${count} Ý TƯỞNG bài đăng mạng xã hội KHÁC GÓC NHÌN nhau, mỗi ý tưởng gồm:
- title: tiêu đề/góc nhìn ngắn gọn, hấp dẫn (1 dòng)
- summary: 2-3 câu mô tả nội dung/insight chính sẽ khai thác

Trả về DUY NHẤT JSON array hợp lệ, không markdown, không giải thích:
[{"title":"...","summary":"..."}, ...]`;
}

function parseIdeas(raw: string, count: number): Idea[] {
  if (!raw) return [];
  let txt = raw.trim();
  // bỏ rào ```json nếu có
  txt = txt.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  const start = txt.indexOf('[');
  const end = txt.lastIndexOf(']');
  if (start >= 0 && end > start) txt = txt.slice(start, end + 1);
  try {
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) {
      return arr
        .map((x: any) => ({ title: cleanText(x?.title || ''), summary: cleanText(x?.summary || x?.desc || '') }))
        .filter((x: Idea) => x.title.length > 3)
        .slice(0, count);
    }
  } catch { /* fall through */ }
  return [];
}

async function viaGemini(topic: string, count: number): Promise<string | null> {
  const key = await getSetting('GEMINI_API_KEY');
  if (!key) return null;
  const model = await pickGeminiModel(await getSetting('GEMINI_MODEL'));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: buildPrompt(topic, count) }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 1200 } }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function viaOpenAI(topic: string, count: number): Promise<string | null> {
  const key = await getSetting('OPENAI_API_KEY');
  if (!key) return null;
  const model = (await getSetting('OPENAI_MODEL')) || 'gpt-4o-mini';
  const isReasoning = /^(o\d|gpt-5)/i.test(model);
  const messages = [{ role: 'user', content: buildPrompt(topic, count) }];
  const callOpenAI = async (body: any) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Model reasoning (GPT-5/o-series) không nhận temperature tuỳ chỉnh.
  let res = await callOpenAI(isReasoning ? { model, messages } : { model, temperature: 0.9, max_tokens: 1200, messages });
  if (!res.ok && !isReasoning) res = await callOpenAI({ model, messages }); // retry tối giản nếu lỗi param
  if (!res.ok) return null;
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || null;
}

async function viaAnthropic(topic: string, count: number): Promise<string | null> {
  const key = await getSetting('ANTHROPIC_API_KEY');
  if (!key) return null;
  const model = (await getSetting('ANTHROPIC_MODEL')) || 'claude-sonnet-4-6';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: buildPrompt(topic, count) }] }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.content?.[0]?.text || null;
}

export async function generateIdeas(topic: string, count = 8): Promise<{ ideas: Idea[]; error?: string }> {
  for (const fn of [viaGemini, viaOpenAI, viaAnthropic]) {
    try {
      const raw = await fn(topic, count);
      if (raw) {
        const ideas = parseIdeas(raw, count);
        if (ideas.length) return { ideas };
      }
    } catch { /* next */ }
  }
  return { ideas: [], error: 'Chưa cấu hình AI key (Gemini/OpenAI/Anthropic) hoặc AI không trả ý tưởng. Vào /settings.' };
}
