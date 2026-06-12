import { sql } from '@/lib/db';
import { generateImageDetailed } from '@/lib/ai/image-generator';

export const maxDuration = 60;
export const runtime = 'nodejs';

// Tạo (lại) ảnh AI cho 1 post đã viết — không cần viết lại bài.
export async function POST(req: Request) {
  try {
    const { postId, provider, model } = await req.json();
    if (!postId) return Response.json({ error: 'Thiếu postId' }, { status: 400 });

    const [post] = await sql`
      SELECT p.id, p.content, a.title as article_title
      FROM posts p LEFT JOIN articles a ON p.article_id = a.id
      WHERE p.id = ${postId}`;
    if (!post) return Response.json({ error: 'Không tìm thấy bài' }, { status: 404 });

    // Chủ đề ảnh: ưu tiên tiêu đề bài gốc, fallback 200 ký tự đầu của content
    const topic = (post.article_title || String(post.content || '').slice(0, 200) || 'AI technology').trim();

    const r = await generateImageDetailed(topic, { provider, model });
    if (!r.url) {
      return Response.json({ error: r.error || 'Không tạo được ảnh' }, { status: 400 });
    }

    await sql`UPDATE posts SET generated_image_url = ${r.url} WHERE id = ${postId}`;
    return Response.json({ url: r.url, modelUsed: r.modelUsed });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
