import { getSetting } from '../settings';
import { DEFAULT_PERSONA, getFormatPrompt } from './personas';
import { stripMarkdown } from '../textClean';

const BASE_URL = 'https://api.twinexpert.com/api/v1';

async function callTwin(apiKey: string, _twinId: string, userMessage: string): Promise<string> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };

  // Step 1: by-namespace (twinId tự lấy từ key). Namespace duy nhất cho mỗi lần viết.
  const namespace = `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let conversationId = '';
  let lastErr = '';
  {
    const res = await fetch(`${BASE_URL}/conversations/by-namespace`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ namespace, title: 'AI Content Pipeline' }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`TwinExpert tạo conversation lỗi (${res.status}): ${text.slice(0, 200)}`);
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON: ${text.slice(0, 200)}`); }
    conversationId = json?.data?.id || json?.data?._id || json?.id || json?._id || json?.conversation?.id || '';
    if (!conversationId) throw new Error(`Không tìm thấy conversation id: ${text.slice(0, 200)}`);
  }

  // Step 2: Send the message (non-stream). Response: data.assistantMessage.content
  let aiText = '';
  {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: userMessage }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`TwinExpert gửi message lỗi (${res.status}): ${text.slice(0, 300)}`);
    let json: any;
    try { json = JSON.parse(text); } catch { lastErr = `Non-JSON: ${text.slice(0, 200)}`; }

    aiText = json?.data?.assistantMessage?.content
      || json?.data?.assistant_message?.content
      || json?.data?.message?.content
      || json?.data?.response?.content
      || json?.data?.content
      || json?.data?.text
      || json?.assistantMessage?.content
      || json?.message?.content
      || json?.content
      || json?.text
      || '';
    if (typeof aiText === 'object') aiText = JSON.stringify(aiText);
    if (!aiText) lastErr = `Không thấy nội dung trả lời: ${text.slice(0, 300)}`;
  }
  if (!aiText) throw new Error(`TwinExpert message failed. ${lastErr}`);
  return aiText;
}

export async function writeArticleWithTwinExpert(title: string, summary: string, format: string) {
  const apiKey = await getSetting('TWINEXPERT_API_KEY');
  const twinId = await getSetting('TWINEXPERT_TWIN_ID');
  if (!apiKey) throw new Error('TwinExpert API key chưa được cấu hình. Vào /settings để thêm.');
  if (!twinId) throw new Error('TwinExpert Twin ID chưa được cấu hình. Vào /settings để chọn twin.');

  const custom = await getSetting('WRITER_PERSONA');
  const persona = (custom && custom.trim()) ? custom.trim() : DEFAULT_PERSONA;
  const formatPrompt = getFormatPrompt(format);
  const userMessage = `${persona}

${formatPrompt}

Viết bài Facebook post dựa trên tin tức sau:

Tiêu đề: ${title}
Nội dung: ${summary}

ĐỊNH DẠNG: Viết PLAIN TEXT cho Facebook, KHÔNG dùng markdown (không ** ## * backtick). Nhấn mạnh thì VIẾT HOA hoặc emoji.

Sau bài viết, xuống dòng và thêm ĐÚNG 2 hashtag phù hợp với chủ đề (tiếng Việt không dấu hoặc tiếng Anh, viết liền, bắt đầu bằng #). Chỉ 2 hashtag thôi.`;

  const text = (await callTwin(apiKey, twinId, userMessage)).trim();

  const hashtagIndex = text.lastIndexOf('#');
  const firstHashtagLine = hashtagIndex >= 0 ? text.lastIndexOf('\n', hashtagIndex) : -1;
  const content = firstHashtagLine >= 0 ? text.substring(0, firstHashtagLine).trim() : text;
  const autoHashtags = firstHashtagLine >= 0 ? text.substring(firstHashtagLine).trim() : '';

  const FIXED = '#AI #agent';
  const extra = autoHashtags.startsWith('#') ? autoHashtags : '#AITools #Growth';

  return {
    content: stripMarkdown(content || text),
    hashtags: `${FIXED} ${extra}`,
  };
}

// Lưu ý: API TwinExpert KHÔNG có endpoint /twins — twin gắn tự động với API key.
// Hàm này giữ lại cho tương thích, trả [] (không cần chọn twin nữa).
export async function listTwins(_apiKeyOverride?: string) {
  return [] as any[];
}
