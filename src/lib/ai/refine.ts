import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSetting } from '../settings';
import { stripMarkdown } from '../textClean';
import { writeArticleWithTwinExpert } from './twinexpert-writer';
import type { AIProvider } from './writer';

// Chip tinh chỉnh nhanh
export const REFINE_PRESETS: { id: string; label: string; instruction: string }[] = [
  { id: 'regen', label: '🔄 Viết lại', instruction: 'Viết lại bài theo cách KHÁC, giữ cùng chủ đề và độ dài, hook mới mẻ hơn.' },
  { id: 'shorter', label: 'Ngắn hơn', instruction: 'Viết lại NGẮN HƠN khoảng 40%, giữ ý chính và hook mạnh nhất.' },
  { id: 'longer', label: 'Dài hơn', instruction: 'Mở rộng thêm chi tiết, ví dụ, số liệu — dài hơn khoảng 40%.' },
  { id: 'fun', label: 'Vui hơn', instruction: 'Đổi sang giọng vui vẻ, hài hước, gần gũi hơn nhưng vẫn giữ insight.' },
  { id: 'formal', label: 'Trang trọng', instruction: 'Đổi sang giọng chuyên nghiệp, trang trọng, đáng tin hơn.' },
  { id: 'cta', label: 'Thêm CTA', instruction: 'Thêm một call-to-action mạnh, cụ thể ở cuối bài.' },
  { id: 'sharper', label: 'Bớt sáo rỗng', instruction: 'Cắt hết từ sáo rỗng, đi thẳng vào giá trị, câu sắc và dứt khoát hơn.' },
];

// Preset nền tảng
export const PLATFORM_PRESETS: { id: string; label: string; instruction: string }[] = [
  { id: 'facebook', label: 'Facebook', instruction: 'Tối ưu cho FACEBOOK: 700-900 ký tự, hook mạnh ngay dòng đầu, xuống dòng thoáng giữa các ý, emoji vừa phải, 3-5 hashtag tiếng Việt/Anh ở cuối.' },
  { id: 'linkedin', label: 'LinkedIn', instruction: 'Tối ưu cho LINKEDIN: giọng chuyên nghiệp, 1000-1300 ký tự, mở đầu bằng một insight/nhận định, mỗi ý xuống dòng ngắn, hạn chế emoji, 3 hashtag chuyên ngành ở cuối.' },
  { id: 'x', label: 'X (Twitter)', instruction: 'Tối ưu cho X/TWITTER: RẤT NGẮN, dưới 280 ký tự, 1 hook sắc bén, tối đa 2 hashtag. Nếu nội dung dài thì tách thành thread 2-3 đoạn đánh số (1/ 2/ 3/).' },
  { id: 'threads', label: 'Threads', instruction: 'Tối ưu cho THREADS: giọng đối thoại, gần gũi, ngắn 400-500 ký tự, 1-2 hashtag.' },
  { id: 'instagram', label: 'Instagram', instruction: 'Tối ưu cho INSTAGRAM caption: nhiều cảm xúc, emoji hợp lý, hook ở dòng đầu, xuống dòng đẹp, 8-12 hashtag ở cuối.' },
];

const BASE_SYSTEM = `Bạn là biên tập viên content social media kỳ cựu. Nhiệm vụ: biên tập lại bài đăng theo yêu cầu.
QUY TẮC:
- Giữ nguyên NGÔN NGỮ gốc của bài (thường là tiếng Việt).
- Viết PLAIN TEXT cho mạng xã hội: KHÔNG markdown (không **, ##, *, backtick). Nhấn mạnh thì VIẾT HOA hoặc emoji.
- Giữ chiều sâu/insight, đừng làm nhạt nội dung.
- CHỈ trả về bài viết hoàn chỉnh, không giải thích, không tiêu đề "Bài viết:".
- Cuối bài để các hashtag (bắt đầu bằng #).`;

function buildUser(content: string, hashtags: string, instruction: string) {
  return `YÊU CẦU BIÊN TẬP: ${instruction}

BÀI GỐC:
${content}
${hashtags ? `\nHashtag hiện tại: ${hashtags}` : ''}`;
}

function splitContentAndHashtags(text: string) {
  const idx = text.lastIndexOf('#');
  const lineStart = idx >= 0 ? text.lastIndexOf('\n', idx) : -1;
  const content = lineStart >= 0 ? text.substring(0, lineStart).trim() : text;
  const tags = lineStart >= 0 ? text.substring(lineStart).trim() : '';
  return { content: stripMarkdown(content || text), hashtags: tags.startsWith('#') ? tags : '' };
}

async function viaClaude(content: string, hashtags: string, instruction: string) {
  const apiKey = await getSetting('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Anthropic API key chưa cấu hình (/settings).');
  const model = (await getSetting('ANTHROPIC_MODEL')) || 'claude-sonnet-4-6';
  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model, max_tokens: 1500, temperature: 0.8,
    system: BASE_SYSTEM,
    messages: [{ role: 'user', content: buildUser(content, hashtags, instruction) }],
  });
  return ((msg.content[0] as any)?.text || '').trim();
}

async function viaOpenAI(content: string, hashtags: string, instruction: string) {
  const apiKey = await getSetting('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key chưa cấu hình (/settings).');
  const model = (await getSetting('OPENAI_MODEL')) || 'gpt-4o-mini';
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model, temperature: 0.8,
    messages: [{ role: 'system', content: BASE_SYSTEM }, { role: 'user', content: buildUser(content, hashtags, instruction) }],
  });
  return (res.choices?.[0]?.message?.content || '').trim();
}

async function viaGemini(content: string, hashtags: string, instruction: string) {
  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key chưa cấu hình (/settings).');
  const model = (await getSetting('GEMINI_MODEL')) || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: BASE_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: buildUser(content, hashtags, instruction) }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

export async function refineContent(
  provider: AIProvider,
  content: string,
  hashtags: string,
  instruction: string,
): Promise<{ content: string; hashtags: string }> {
  let raw = '';
  if (provider === 'openai') raw = await viaOpenAI(content, hashtags, instruction);
  else if (provider === 'gemini') raw = await viaGemini(content, hashtags, instruction);
  else if (provider === 'twinexpert') {
    // Twin: gửi prompt gộp qua writer hiện có (title=instruction, summary=content)
    const r = await writeArticleWithTwinExpert(instruction, content, 'pov');
    return { content: r.content, hashtags: hashtags || r.hashtags };
  } else raw = await viaClaude(content, hashtags, instruction);

  const split = splitContentAndHashtags(raw);
  return { content: split.content || raw, hashtags: split.hashtags || hashtags };
}
