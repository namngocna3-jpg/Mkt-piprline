import { sql } from '@/lib/db';
import { refineContent, REFINE_PRESETS, PLATFORM_PRESETS } from '@/lib/ai/refine';
import { fetchArticleText } from '@/lib/research/article-text';
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

    // Lấy NỘI DUNG GỐC đã cào từ bài (để viết lại bám nguồn, không chỉ xào caption).
    let source = '';
    if (postId) {
      try {
        const [post] = await sql`SELECT article_id FROM posts WHERE id = ${postId}`;
        if (post?.article_id) {
          const [art] = await sql`SELECT title, summary, url FROM articles WHERE id = ${post.article_id}`;
          if (art) {
            source = String(art.summary || '');
            if (art.url) {
              const full = await fetchArticleText(art.url);
              if (full && full.length > source.length) source = full;
            }
            if (art.title) source = `Tiêu đề gốc: ${art.title}\n\n${source}`.trim();
          }
        }
      } catch { /* không lấy được nguồn → viết lại từ bản nháp như cũ */ }
    }

    const aiProvider: AIProvider = (provider as AIProvider) || 'gemini';
    const result = await refineContent(aiProvider, content, hashtags || '', instr, source || undefined);

    // save=true → ghi đè post hiện tại; mặc định KHÔNG ghi (để user xem trước)
    if (save && postId) {
      await sql`UPDATE posts SET content = ${result.content}, hashtags = ${result.hashtags} WHERE id = ${postId}`;
    }

    return Response.json({ content: result.content, hashtags: result.hashtags });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
