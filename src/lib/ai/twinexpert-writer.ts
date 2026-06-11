import { getSetting } from '../settings';
import { DEFAULT_PERSONA, getFormatPrompt } from './personas';
import { stripMarkdown } from '../textClean';
import { getOrCreateConversation } from '../twinClient';

const BASE_URL = 'https://api.twinexpert.com/api/v1';

async function callTwin(apiKey: string, twinId: string, userMessage: string): Promise<string> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };

  // Step 1: tạo conversation (helper tự thử by-namespace + /conversations)
  const namespace = `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let lastErr = '';
  const conversationId = await getOrCreateConversation(apiKey, twinId, namespace);

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
  // Twin ID là OPTIONAL — API by-namespace tự lấy twin từ key.
  const twinId = (await getSetting('TWINEXPERT_TWIN_ID')) || '';
  if (!apiKey) throw new Error('TwinExpert API key chưa được cấu hình. Vào /settings để thêm.');

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

export async function listTwins(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || (await getSetting('TWINEXPERT_API_KEY'));
  if (!apiKey) throw new Error('TwinExpert API key chưa được cấu hình.');
  const res = await fetch(`${BASE_URL}/twins`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    if (/invalid api key format/i.test(text)) {
      throw new Error('API key sai định dạng. Key phải dạng "ak_..." — tạo ở twinexpert.com/profile/api-keys (đừng dùng password/username).');
    }
    throw new Error(`Lỗi lấy twins (${res.status}): ${text.slice(0, 200)}`);
  }
  let json: any;
  try { json = JSON.parse(text); } catch { return []; }
  const list = json?.data || json?.twins || json || [];
  return Array.isArray(list) ? list : [];
}
