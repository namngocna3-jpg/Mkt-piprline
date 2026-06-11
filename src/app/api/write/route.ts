import { sql } from '@/lib/db';
import { writeArticle, type AIProvider } from '@/lib/ai/writer';
import { generateImageResponse } from '@/lib/ai/image-generator';

export const maxDuration = 60;
export const runtime = 'nodejs';

const CONCURRENCY = 3;

export async function POST(req: Request) {
  const { selections, provider, generateImages, imageProvider, imageModel } = await req.json();
  const aiProvider: AIProvider = (provider as AIProvider) || 'claude';
  const list: { id: string; format: string }[] = Array.isArray(selections) ? selections : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: any) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      send('start', { total: list.length });

      let done = 0;
      let failed = 0;
      let cursor = 0;

      async function worker() {
        while (cursor < list.length) {
          const myIdx = cursor++;
          const { id: articleId, format } = list[myIdx];
          try {
            const [article] = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
            if (!article) {
              failed++;
              send('post_error', { index: myIdx, articleId, error: 'Không tìm thấy bài gốc' });
              continue;
            }

            const { content, hashtags } = await writeArticle(article.title, article.summary, format, aiProvider);

            let generatedImage: string | null = null;
            if (generateImages) {
              generatedImage = await generateImageResponse(article.title, { provider: imageProvider, model: imageModel });
            }

            const postId = 'p_' + Math.random().toString(36).substring(7);
            await sql`INSERT INTO posts (id, article_id, format, content, hashtags, original_image_url, generated_image_url, ai_provider)
              VALUES (${postId}, ${article.id}, ${format}, ${content}, ${hashtags}, ${article.original_image_url}, ${generatedImage}, ${aiProvider})`;
            await sql`UPDATE articles SET status = 'written' WHERE id = ${article.id}`;

            done++;
            // Lưu xong bài nào -> bắn ngay để UI hiện liền (cho phép sửa từng bài)
            send('post_done', {
              index: myIdx,
              done,
              post: {
                id: postId,
                article_id: article.id,
                article_title: article.title,
                article_url: article.url,
                format,
                content,
                hashtags,
                original_image_url: article.original_image_url,
                generated_image_url: generatedImage,
                ai_provider: aiProvider,
                status: 'draft',
              },
            });
          } catch (e: any) {
            failed++;
            const msg = e?.message || String(e);
            send('post_error', { index: myIdx, articleId, error: msg.slice(0, 300) });
          }
        }
      }

      try {
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length || 1) }, () => worker()));
        send('done', { count: done, failed, total: list.length });
      } catch (e: any) {
        send('error', { message: e?.message || String(e), done, failed });
      } finally {
        closed = true;
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
