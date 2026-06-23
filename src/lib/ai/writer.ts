import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSetting } from '../settings';
import { writeArticleWithTwinExpert } from './twinexpert-writer';
import { DEFAULT_PERSONA, getFormatPrompt } from './personas';
import { pickGeminiModel } from './gemini-models';
import { stripMarkdown } from '../textClean';

// Quy tắc chung: viết cho Facebook nên KHÔNG dùng markdown.
const FB_RULE = `\n\nĐỊNH DẠNG ĐẦU RA (BẮT BUỘC): Viết PLAIN TEXT cho Facebook. TUYỆT ĐỐI KHÔNG dùng markdown — không **đậm**, không ## tiêu đề, không *nghiêng*, không backtick. Muốn nhấn mạnh thì VIẾT HOA hoặc dùng emoji. Xuống dòng bình thường để tách đoạn.`;

// Persona giờ load động từ setting WRITER_PERSONA (user tự cấu hình ở /settings).
// Fallback về DEFAULT_PERSONA (preset Growth & Content) nếu chưa set.
async function getSystemPrompt(): Promise<string> {
  const custom = await getSetting('WRITER_PERSONA');
  const persona = (custom && custom.trim()) ? custom.trim() : DEFAULT_PERSONA;
  return `${persona}

ĐỘ DÀI LÝ TƯỞNG: Ngắn gọn, súc tích, khoảng 700-800 ký tự. Không viết lan man.${FB_RULE}`;
}

export type AIProvider = 'claude' | 'openai' | 'gemini' | 'twinexpert';

function splitContentAndHashtags(text: string) {
  const hashtagIndex = text.lastIndexOf('#');
  const firstHashtagLine = hashtagIndex >= 0 ? text.lastIndexOf('\n', hashtagIndex) : -1;
  const content = firstHashtagLine >= 0 ? text.substring(0, firstHashtagLine).trim() : text;
  const autoHashtags = firstHashtagLine >= 0 ? text.substring(firstHashtagLine).trim() : '';
  const FIXED = '#AI #agent';
  const extra = autoHashtags.startsWith('#') ? autoHashtags : '#AITools #Growth';
  // Strip markdown để post sạch cho Facebook
  return { content: stripMarkdown(content || text), hashtags: `${FIXED} ${extra}` };
}

function buildUserMessage(title: string, summary: string) {
  return `Viết bài Facebook post dựa trên tin tức sau:\n\nTiêu đề: ${title}\nNội dung: ${summary}\n\nSau bài viết, xuống dòng và thêm ĐÚNG 2 hashtags phù hợp với chủ đề (tiếng Việt không dấu hoặc tiếng Anh, viết liền, bắt đầu bằng #). Chỉ 2 hashtag thôi.`;
}

// Gọi OpenAI chat AN TOÀN với mọi đời model.
// Model reasoning (GPT-5, o1/o3/o4...) KHÔNG nhận temperature tuỳ chỉnh & dùng max_completion_tokens.
// → tự bỏ tham số không hỗ trợ và thử lại khi API báo lỗi param.
export async function openaiChat(openai: OpenAI, model: string, system: string, user: string): Promise<string> {
  const isReasoning = /^(o\d|gpt-5|gpt-4\.1-mini-reasoning)/i.test(model);
  const base: any = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (!isReasoning) base.temperature = 0.85;

  const call = async (params: any) => {
    const res = await openai.chat.completions.create(params);
    return res.choices?.[0]?.message?.content?.trim() || '';
  };

  try {
    return await call(base);
  } catch (e: any) {
    const msg = String(e?.message || e);
    // Retry: bỏ temperature nếu model không cho; đổi max_tokens → max_completion_tokens.
    if (/temperature|max_tokens|unsupported|not supported|param|Unrecognized/i.test(msg)) {
      const retry: any = { model: base.model, messages: base.messages };
      try {
        return await call(retry);
      } catch (e2: any) {
        throw new Error(`OpenAI (${model}): ${String(e2?.message || e2).slice(0, 200)}`);
      }
    }
    throw e;
  }
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
  const text = await openaiChat(openai, model, `${systemPrompt}\n\n${formatPrompt}`, buildUserMessage(title, summary));
  return splitContentAndHashtags(text);
}

async function writeWithGemini(title: string, summary: string, format: string) {
  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key chưa được cấu hình. Vào /settings để thêm.');
  const model = await pickGeminiModel(await getSetting('GEMINI_MODEL'));
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
