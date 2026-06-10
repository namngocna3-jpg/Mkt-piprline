import { getSetting } from '../settings';

const BASE_URL = 'https://api.twinexpert.com/api/v1';

const POV_PROMPT = `FORMAT: POV (Góc nhìn cá nhân & Phân tích chuyên sâu)
Viết bài Facebook ngắn (~700 ký tự, 150-180 từ) theo bố cục:
1. HOOK: 1 câu STATEMENT mạnh, VIẾT HOA TOÀN BỘ
2. Mổ xẻ vấn đề sâu sắc, chỉ ra lỗ hổng hoặc điểm chết ít ai thấy
3. Đưa ra góc nhìn/judgment riêng
4. Câu chốt insight cắm rễ vào não độc giả
Văn phong gãy gọn, không sáo rỗng, không phông bạt.`;

const NEWS_PROMPT = `FORMAT: News/Info (Thông tin chiều sâu)
Viết bài Facebook ngắn (~700-800 ký tự) theo bố cục:
1. HOOK: VIẾT HOA TOÀN BỘ một phát hiện động trời từ tin
2. 2-3 số liệu/thông tin cốt lõi, gạch đầu dòng ngắn gọn
3. Phân tích sâu: ý nghĩa thực tế với người làm nghề
4. Câu chốt mở đường áp dụng
Bám sát số liệu nhưng phải có phân tích, không dịch khô khan.`;

async function callTwin(apiKey: string, twinId: string, userMessage: string): Promise<string> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };

  // Step 1: Create a conversation. Try multiple field name conventions.
  const convPayloads = [
    { twin_id: twinId, title: 'AI Content Pipeline' },
    { twinId: twinId, title: 'AI Content Pipeline' },
    { twin: twinId, title: 'AI Content Pipeline' },
  ];
  let conversationId = '';
  let lastErr = '';
  for (const body of convPayloads) {
    const res = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      lastErr = `[create conversation] ${res.status} ${text}`;
      continue;
    }
    let json: any;
    try { json = JSON.parse(text); } catch { lastErr = `Non-JSON: ${text.slice(0, 200)}`; continue; }
    conversationId = json?.data?.id || json?.data?._id || json?.id || json?._id || json?.conversation?.id || '';
    if (conversationId) break;
    lastErr = `No conversation id in response: ${text.slice(0, 200)}`;
  }
  if (!conversationId) throw new Error(`TwinExpert create conversation failed. ${lastErr}`);

  // Step 2: Send the prompt as a message.
  const msgPayloads = [
    { content: userMessage },
    { message: userMessage },
    { text: userMessage },
  ];
  let aiText = '';
  lastErr = '';
  for (const body of msgPayloads) {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      lastErr = `[send message] ${res.status} ${text.slice(0, 300)}`;
      continue;
    }
    let json: any;
    try { json = JSON.parse(text); } catch { lastErr = `Non-JSON: ${text.slice(0, 200)}`; continue; }

    // Try many common response shapes
    aiText = json?.data?.assistant_message?.content
      || json?.data?.assistantMessage?.content
      || json?.data?.message?.content
      || json?.data?.response?.content
      || json?.data?.content
      || json?.data?.text
      || json?.assistant_message?.content
      || json?.message?.content
      || json?.response
      || json?.content
      || json?.text
      || '';
    if (typeof aiText === 'object') aiText = JSON.stringify(aiText);
    if (aiText) break;
    lastErr = `No assistant content in response: ${text.slice(0, 300)}`;
  }
  if (!aiText) throw new Error(`TwinExpert message failed. ${lastErr}`);
  return aiText;
}

export async function writeArticleWithTwinExpert(title: string, summary: string, format: string) {
  const apiKey = await getSetting('TWINEXPERT_API_KEY');
  const twinId = await getSetting('TWINEXPERT_TWIN_ID');
  if (!apiKey) throw new Error('TwinExpert API key chưa được cấu hình. Vào /settings để thêm.');
  if (!twinId) throw new Error('TwinExpert Twin ID chưa được cấu hình. Vào /settings để chọn twin.');

  const formatPrompt = format === 'pov' ? POV_PROMPT : NEWS_PROMPT;
  const userMessage = `${formatPrompt}

Viết bài Facebook post dựa trên tin tức sau:

Tiêu đề: ${title}
Nội dung: ${summary}

Sau bài viết, xuống dòng và thêm ĐÚNG 2 hashtag phù hợp với chủ đề (tiếng Việt không dấu hoặc tiếng Anh, viết liền, bắt đầu bằng #). Chỉ 2 hashtag thôi.`;

  const text = (await callTwin(apiKey, twinId, userMessage)).trim();

  const hashtagIndex = text.lastIndexOf('#');
  const firstHashtagLine = hashtagIndex >= 0 ? text.lastIndexOf('\n', hashtagIndex) : -1;
  const content = firstHashtagLine >= 0 ? text.substring(0, firstHashtagLine).trim() : text;
  const autoHashtags = firstHashtagLine >= 0 ? text.substring(firstHashtagLine).trim() : '';

  const FIXED = '#AI #agent';
  const extra = autoHashtags.startsWith('#') ? autoHashtags : '#AITools #Growth';

  return {
    content: content || text,
    hashtags: `${FIXED} ${extra}`,
  };
}

export async function listTwins(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || (await getSetting('TWINEXPERT_API_KEY'));
  if (!apiKey) throw new Error('TwinExpert API key chưa được cấu hình.');
  const res = await fetch(`${BASE_URL}/twins`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Lỗi lấy danh sách twins (${res.status}): ${text.slice(0, 300)}`);
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Response không phải JSON: ${text.slice(0, 200)}`); }
  const list = json?.data || json?.twins || json || [];
  return Array.isArray(list) ? list : [];
}
