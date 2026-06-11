import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSetting } from '../settings';
import { writeArticleWithTwinExpert } from './twinexpert-writer';
import { DEFAULT_PERSONA, getFormatPrompt } from './personas';

// Persona giờ load động từ setting WRITER_PERSONA (user tự cấu hình ở /settings).
// Fallback về DEFAULT_PERSONA (preset Growth & Content) nếu chưa set.
async function getSystemPrompt(): Promise<string> {
  const custom = await getSetting('WRITER_PERSONA');
  const persona = (custom && custom.trim()) ? custom.trim() : DEFAULT_PERSONA;
  return `${persona}

ĐỘ DÀI LÝ TƯỞNG: Ngắn gọn, súc tích, khoảng 700-800 ký tự. Không viết lan man.`;
}

export type AIProvider = 'claude' | 'openai' | 'gemini' | 'twinexpert';

function splitContentAndHashtags(text: string) {
  const hashtagIndex = text.lastIndexOf('#');
  const firstHashtagLine = hashtagIndex >= 0 ? text.lastIndexOf('\n', hashtagIndex) : -1;
  const content = firstHashtagLine >= 0 ? text.substring(0, firstHashtagLine).trim() : text;
  const autoHashtags = firstHashtagLine >= 0 ? text.substring(firstHashtagLine).trim() : '';
  const FIXED = '#AI #agent';
  const extra = autoHashtags.startsWith('#') ? autoHashtags : '#AITools #Growth';
  return { content: content || text, hashtags: `${FIXED} ${extra}` };
}

function buildUserMessage(title: string, summary: string) {
  return `Viết bài Facebook post dựa trên tin tức sau:\n\nTiêu đề: ${title}\nNội dung: ${summary}\n\nSau bài viết, xuống dòng và thêm ĐÚNG 2 hashtags phù hợp với chủ đề (tiếng Việt không dấu hoặc tiếng Anh, viết liền, bắt đầu bằng #). Chỉ 2 hashtag thôi.`;
}

async function writeWithClaude(title: string, summary: string, format: string) {
  const apiKey = await getSetting('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Anthropic API key chưa được cấu hình. Vào /settings để thêm.');
  const model = (await getSetting('ANTHROPIC_MODEL')) || 'claude-opus-4-5';
  const anthropic = new Anthropic({ apiKey });
  const [systemPrompt, formatPrompt] = [await getSystemPrompt(), getFormatPrompt(format)];
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.85,
    system: `${systemPrompt}\n\n${formatPrompt}`,
    messages: [{ role: 'user', content: buildUserMessage(title, summary) }],
  });
  const text = (msg.content[0] as any).text?.trim() || '';
  return splitContentAndHashtags(text);
}

async function writeWithOpenAI(title: string, summary: string, format: string) {
  const apiKey = await getSetting('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key chưa được cấu hình. Vào /settings để thêm.');
  const model = (await getSetting('OPENAI_MODEL')) || 'gpt-4o';
  const openai = new OpenAI({ apiKey });
  const [systemPrompt, formatPrompt] = [await getSystemPrompt(), getFormatPrompt(format)];
  const res = await openai.chat.completions.create({
    model,
    temperature: 0.85,
    messages: [
      { role: 'system', content: `${systemPrompt}\n\n${formatPrompt}` },
      { role: 'user', content: buildUserMessage(title, summary) },
    ],
  });
  const text = res.choices?.[0]?.message?.content?.trim() || '';
  return splitContentAndHashtags(text);
}

async function writeWithGemini(title: string, summary: string, format: string) {
  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key chưa được cấu hình. Vào /settings để thêm.');
  const model = (await getSetting('GEMINI_MODEL')) || 'gemini-2.0-flash';
  const [systemPrompt, formatPrompt] = [await getSystemPrompt(), getFormatPrompt(format)];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${systemPrompt}\n\n${formatPrompt}` }] },
      contents: [{ role: 'user', parts: [{ text: buildUserMessage(title, summary) }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 1500 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API lỗi (${res.status}): ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  return splitContentAndHashtags(text);
}

export async function writeArticle(title: string, summary: string, format: string, provider: AIProvider = 'claude') {
  switch (provider) {
    case 'openai': return writeWithOpenAI(title, summary, format);
    case 'gemini': return writeWithGemini(title, summary, format);
    case 'twinexpert': return writeArticleWithTwinExpert(title, summary, format);
    case 'claude':
    default: return writeWithClaude(title, summary, format);
  }
}
