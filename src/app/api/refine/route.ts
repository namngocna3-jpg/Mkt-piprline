import { sql } from '@/lib/db';
import { refineContent, REFINE_PRESETS, PLATFORM_PRESETS } from '@/lib/ai/refine';
import type { AIProvider } from '@/lib/ai/writer';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { postId, content, hashtags, instruction, presetId, platformId, provider, save } = await req.json();
    if (!content) return Response.json({ error: 'Thiếu nội dung' }, { status: 400 });

    // Xác định instruction: từ preset / platform / hoặc free text
    let instr = instruction || '';
    if (presetId) instr = REFINE_PRESETS.find(p => p.id === presetId)?.instruction || instr;
    if (platformId) instr = PLATFORM_PRESETS.find(p => p.id === platformId)?.instruction || instr;
    if (!instr) return Response.json({ error: 'Thiếu yêu cầu biên tập' }, { status: 400 });

    const aiProvider: AIProvider = (provider as AIProvider) || 'gemini';
    const result = await refineContent(aiProvider, content, hashtags || '', instr);

    // save=true → ghi đè post hiện tại; mặc định KHÔNG ghi (để user xem trước)
    if (save && postId) {
      await sql`UPDATE posts SET content = ${result.content}, hashtags = ${result.hashtags} WHERE id = ${postId}`;
    }

    return Response.json({ content: result.content, hashtags: result.hashtags });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
