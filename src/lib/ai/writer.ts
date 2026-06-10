import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSetting } from '../settings';
import { writeArticleWithTwinExpert } from './twinexpert-writer';

const SYSTEM_PROMPT = `Bạn là Phương — người làm Growth & Content, chuyên về AI tools, Affiliate Marketing và AEO/SEO. Viết bài đúng giọng văn bài mẫu của Phương: thực chiến, sắc sảo, có chiều sâu phân tích, không sáo rỗng.

ĐẶC ĐIỂM GIỌNG VĂN BẮT BUỘC:
- HOOK ẤN TƯỢNG: Luôn mở đầu bằng 1-2 câu VIẾT HOA TOÀN BỘ mang tính giật gân, trái chiều, hoặc đưa ra insight chấn động (VD: "LÊN TOP 1 GOOGLE BÂY GIỜ... CHƯA CHẮC ĐÃ CÓ TIỀN", "SENIOR KHÔNG CÒN ĐẮT GIÁ VÌ LÀM NHANH").
- Xưng "Phương" (không lạm dụng), gọi "bạn" hoặc "cả nhà". Tông điệu chia sẻ insight thực chiến, không thao túng, không phông bạt.
- LUÔN PHÂN TÍCH SÂU: Không bao giờ chỉ đưa tin bề mặt. Trả lời câu hỏi: "Bản chất cuối cùng của việc này là gì?", "Tại sao lại thế?", "Người trong ngành phải làm gì?".
- Văn phong gãy gọn: Câu ngắn, dứt khoát. Xóa ngay các từ sáo rỗng (tuyệt vời, bùng nổ, hoàn hảo). Có thể Mix chút English chuyên ngành (ROI, execution, judgment, baseline...).
- ĐỘ DÀI LÝ TƯỞNG: Ngắn gọn, súc tích, khoảng 700 - 800 ký tự. Không viết lan man.

KẾT BÀI PHÙ HỢP:
- Chốt lại bằng 1 câu insight cốt lõi in hoa (VD: "KHI EXECUTION TRỞ NÊN RẺ, JUDGMENT SẼ TRỞ NÊN ĐẮT").
- Kèm lời kêu gọi nhẹ nhàng: "Cách cài đặt ở dưới nhé", "Bạn setup thử rồi feedback nha", "Sự thay đổi đang đến gắt lắm. Đổi cách chơi thôi cả nhà ơi!".`;

const POV_PROMPT = `FORMAT: POV (Góc nhìn cá nhân & Phân tích chuyên sâu)

Nhiệm vụ: Đọc kỹ bài source, tìm ra 1 LỖ HỔNG hoặc 1 ĐIỂM CHẾT mà ít ai thấy, biến nó thành GÓC NHÌN sắc bén của riêng Phương.

BỐ CỤC:
1. HOOK: 1 câu STATEMENT mạnh bạo, VIẾT HOA (Ví dụ: "TRONG KHI NHIỀU NGƯỜI SỢ AI CƯỚP VIỆC, GEN Z ĐANG DÙNG NÓ ĐỂ THÀNH TỶ PHÚ.")
2. VẤN ĐỀ/LUẬN ĐIỂM SÂU SẮC: Mổ xẻ sự cố/sự kiện từ bài báo. Giải thích kỹ hơn bản chất của nó (Tại sao số đông đang hiểu sai? Quy luật cuộc chơi đang thay đổi thế nào?).
3. GÓC NHÌN PHƯƠNG: Giải thích cơ chế, đưa ra judgment (phán đoán) của mình (VD: "Thứ thị trường trả tiền mạnh hơn sẽ là...", "Bạn đang lãng phí một nhân sự...").
4. CÂU CHỐT: 1 câu insight cắm rễ vào não người đọc.

Lưu ý: Viết sắc bén, độ dài giới hạn tầm 700 ký tự (khoảng 150-180 từ). Thể hiện rõ tư duy "đi trước đám đông một bước". Cấm viết kiểu văn mẫu báo cáo.`;

const NEWS_PROMPT = `FORMAT: News/Info (Thông tin chiều sâu dựa trên dữ liệu thật)

Nhiệm vụ: Cung cấp thông tin TỪ BÀI GỐC nhưng theo cách của một người chơi hệ Data/Growth thực chiến.

BỐ CỤC:
1. HOOK: Viết hoa toàn bộ một phát hiện động trời từ thông tin báo cáo (VD: "LÊN TOP 1 GOOGLE BÂY GIỜ... CHƯA CHẮC ĐÃ CÓ TIỀN VÌ KHÁCH HÀNG ĐÃ CHUYỂN SANG HỎI")
2. THÔNG TIN CỐT LÕI (Từ source): Trình bày 2-3 số liệu/thông tin đáng giá nhất. Dùng gạch đầu dòng ngắn gọn.
3. PHÂN TÍCH/GIẢI THÍCH SÂU: Kéo dữ liệu đó về thực tế. Nó có ý nghĩa gì với người làm nghề? Nếu không update thì sẽ thế nào? (Giống cách Phương mổ xẻ "AEO thay thế SEO cũ").
4. KẾT BÀI: Một câu chốt mở đường cho việc áp dụng hoặc hỏi quan điểm.

Lưu ý: Bám cực sát số liệu từ SOURCE. NHƯNG không dịch khô khan, phải có PHÂN TÍCH SÂU ở bên dưới để độc giả thấy giá trị. Câu văn ngắn, nhịp điệu nhanh. Độ dài khoảng 700 - 800 ký tự (150-180 từ).`;

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
  const formatPrompt = format === 'pov' ? POV_PROMPT : NEWS_PROMPT;
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.85,
    system: `${SYSTEM_PROMPT}\n\n${formatPrompt}`,
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
  const formatPrompt = format === 'pov' ? POV_PROMPT : NEWS_PROMPT;
  const res = await openai.chat.completions.create({
    model,
    temperature: 0.85,
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${formatPrompt}` },
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
  const formatPrompt = format === 'pov' ? POV_PROMPT : NEWS_PROMPT;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n${formatPrompt}` }] },
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
