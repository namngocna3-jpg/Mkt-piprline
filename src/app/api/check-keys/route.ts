import { getAllSettings } from '@/lib/settings';

export const runtime = 'nodejs';

// Trả về trạng thái có/không có key cho từng dịch vụ, để UI báo trước khi gọi (tránh user phát hiện thiếu key sau khi đợi viết 5 bài).
export async function GET() {
  try {
    const s = await getAllSettings();
    const has = (k: string) => !!(s[k] && String(s[k]).trim());
    return Response.json({
      // AI viết
      claude: has('ANTHROPIC_API_KEY'),
      openai: has('OPENAI_API_KEY'),
      gemini: has('GEMINI_API_KEY'),
      twinexpert: has('TWINEXPERT_API_KEY'),
      // Ảnh dùng CHUNG key OpenAI/Gemini
      image_openai: has('OPENAI_API_KEY'),
      image_gemini: has('GEMINI_API_KEY'),
      // Search
      brave: has('BRAVE_API_KEY'),
      tavily: has('TAVILY_API_KEY'),
      // Vision
      groq: has('GROQ_API_KEY'),
      openrouter: has('OPENROUTER_API_KEY'),
      // RapidAPI
      rapid: has('RAPID_API_KEY'),
      youtube: has('YOUTUBE_API_KEY'),
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
