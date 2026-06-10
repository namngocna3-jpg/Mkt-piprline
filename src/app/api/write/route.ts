import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { writeArticle, type AIProvider } from '@/lib/ai/writer';
import { generateImageResponse } from '@/lib/ai/image-generator';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { selections, provider } = await req.json();
    const aiProvider: AIProvider = (provider as AIProvider) || 'claude';

    for (const { id: articleId, format } of selections) {
      const [article] = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
      if (!article) continue;

      const { content, hashtags } = await writeArticle(article.title, article.summary, format, aiProvider);
      const generatedImage = await generateImageResponse(article.title);

      const postId = "p_" + Math.random().toString(36).substring(7);
      await sql`INSERT INTO posts (id, article_id, format, content, hashtags, original_image_url, generated_image_url, ai_provider) VALUES (${postId}, ${article.id}, ${format}, ${content}, ${hashtags}, ${article.original_image_url}, ${generatedImage}, ${aiProvider})`;
      await sql`UPDATE articles SET status = 'written' WHERE id = ${article.id}`;
    }
    return NextResponse.json({ success: true, count: selections.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
