import type { ScrapedArticle } from './rss-scraper';

// Lemmy API — FREE, KHÔNG cần API key (fediverse, kiểu Reddit).
// Tìm post top theo từ khóa AI trên instance lemmy.world (cho phép GET ẩn danh).
const INSTANCE = 'https://lemmy.world';
const QUERIES = ['artificial intelligence', 'LLM', 'ChatGPT', 'AI tools'];

export async function scrapeLemmy(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(QUERIES.map(async (q) => {
    try {
      const url = `${INSTANCE}/api/v3/search?q=${encodeURIComponent(q)}&type_=Posts&sort=TopWeek&listing_type=All&limit=10`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0' } });
      if (!res.ok) return;
      const json = await res.json();
      for (const row of (json?.posts || [])) {
        const post = row?.post;
        if (!post) continue;
        const link = post.url || `${INSTANCE}/post/${post.id}`;
        if (seen.has(link)) continue;
        seen.add(link);
        const community = row?.community?.name || '';
        const score = row?.counts?.score ?? 0;
        const comments = row?.counts?.comments ?? 0;
        out.push({
          title: post.name || '',
          url: link,
          summary: `💬 ${score} điểm · ${comments} bình luận${community ? ` · c/${community}` : ''}\n${String(post.body || '').slice(0, 400)}`.slice(0, 500),
          imageUrl: post.thumbnail_url || null,
          publishedAt: post.published ? new Date(post.published).toISOString() : new Date().toISOString(),
          sourceName: 'Lemmy',
        });
      }
    } catch { /* bỏ qua query lỗi */ }
  }));
  return out.slice(0, 30);
}
