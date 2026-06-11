import { NextResponse } from 'next/server';
import { sql, initDb, seedDb } from '@/lib/db';
import { scrapeAllRSSFeeds, ScrapedArticle } from '@/lib/research/rss-scraper';
import { searchSocialMedia } from '@/lib/research/social-scraper';
import { scrapeHackerNews } from '@/lib/research/hackernews-scraper';
import { scrapeReddit } from '@/lib/research/reddit-scraper';
import { scrapeGithubTrending } from '@/lib/research/github-scraper';
import { scrapeArxiv } from '@/lib/research/arxiv-scraper';
import { scrapeProductHunt } from '@/lib/research/producthunt-scraper';
import { scrapeYoutube } from '@/lib/research/youtube-scraper';
import { scrapeTiktok } from '@/lib/research/tiktok-scraper';
import { scrapeLinkedIn } from '@/lib/research/linkedin-scraper';
import { scrapeMastodon } from '@/lib/research/mastodon-scraper';
import { scrapeBluesky } from '@/lib/research/bluesky-scraper';
import { scrapeMedium } from '@/lib/research/medium-scraper';
import { scrapeDevto } from '@/lib/research/devto-scraper';
import { scrapeLobsters } from '@/lib/research/lobsters-scraper';
import { scrapeThreads } from '@/lib/research/threads-scraper';
import { scrapePinterest } from '@/lib/research/pinterest-scraper';
import { scrapeQuora } from '@/lib/research/quora-scraper';

export const maxDuration = 60;

type Source = 'all' | 'news' | 'x' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin'
  | 'reddit' | 'hackernews' | 'github' | 'arxiv' | 'producthunt'
  | 'mastodon' | 'bluesky' | 'medium' | 'devto' | 'lobsters'
  | 'threads' | 'pinterest' | 'quora';

const include = (filter: string, key: Source) => filter === 'all' || filter === key;

export async function POST(req: Request) {
  try {
    // Khởi tạo Database nếu chưa có
    try {
      await initDb();
      await seedDb();
    } catch(e) { console.error("DB Init Error:", e) }

    const { sourceFilter, limit } = await req.json();
    const filter = (sourceFilter || 'all') as string;
    const maxArticles = Math.max(1, Math.min(Number(limit) || 20, 100)); // giới hạn số bài lấy về

    // Chạy parallel để tiết kiệm thời gian
    const tasks: Array<Promise<ScrapedArticle[]>> = [];

    if (include(filter, 'news')) {
      tasks.push((async () => {
        const rssSources = await sql`SELECT name, rss_url FROM sources WHERE type = 'rss' AND active = 1`;
        return scrapeAllRSSFeeds(rssSources as any);
      })());
    }
    if (include(filter, 'x')) tasks.push(searchSocialMedia('x').catch(() => []));
    if (include(filter, 'instagram')) tasks.push(searchSocialMedia('instagram').catch(() => []));
    if (include(filter, 'tiktok')) tasks.push(scrapeTiktok().catch(() => []));
    if (include(filter, 'youtube')) tasks.push(scrapeYoutube().catch(() => []));
    if (include(filter, 'linkedin')) tasks.push(scrapeLinkedIn().catch(() => []));
    if (include(filter, 'reddit')) tasks.push(scrapeReddit().catch(() => []));
    if (include(filter, 'hackernews')) tasks.push(scrapeHackerNews().catch(() => []));
    if (include(filter, 'github')) tasks.push(scrapeGithubTrending().catch(() => []));
    if (include(filter, 'arxiv')) tasks.push(scrapeArxiv().catch(() => []));
    if (include(filter, 'producthunt')) tasks.push(scrapeProductHunt().catch(() => []));
    if (include(filter, 'mastodon')) tasks.push(scrapeMastodon().catch(() => []));
    if (include(filter, 'bluesky')) tasks.push(scrapeBluesky().catch(() => []));
    if (include(filter, 'medium')) tasks.push(scrapeMedium().catch(() => []));
    if (include(filter, 'devto')) tasks.push(scrapeDevto().catch(() => []));
    if (include(filter, 'lobsters')) tasks.push(scrapeLobsters().catch(() => []));
    if (include(filter, 'threads')) tasks.push(scrapeThreads().catch(() => []));
    if (include(filter, 'pinterest')) tasks.push(scrapePinterest().catch(() => []));
    if (include(filter, 'quora')) tasks.push(scrapeQuora().catch(() => []));

    const settled = await Promise.allSettled(tasks);
    const allArticles: ScrapedArticle[] = settled
      .filter((r): r is PromiseFulfilledResult<ScrapedArticle[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Ưu tiên bài có ngày MỚI nhất; bài không rõ ngày xếp cuối. Rồi cắt theo maxArticles.
    const ts = (a: ScrapedArticle) => {
      if (!a.publishedAt) return 0;
      const t = new Date(a.publishedAt).getTime();
      return isNaN(t) ? 0 : t;
    };
    const articles = allArticles
      .sort((x, y) => ts(y) - ts(x))
      .slice(0, maxArticles);

    let count = 0;
    
    for (const a of articles) {
      // Create ad-hoc source if not exists
      let [source] = await sql`SELECT id FROM sources WHERE name = ${a.sourceName}`;
      if (!source) {
        const newSourceId = "s_" + Math.random().toString(36).substring(7);
        await sql`INSERT INTO sources (id, name, type) VALUES (${newSourceId}, ${a.sourceName}, 'social')`;
        source = { id: newSourceId };
      }

      try {
        const id = "a_" + Math.random().toString(36).substring(7);
        // Convert ảnh gốc sang base64 ngay lúc scrape để tránh URL expire
        let imageData = a.imageUrl;
        if (a.imageUrl && a.imageUrl.startsWith('http')) {
          // Chọn Referer phù hợp theo nguồn
          const referer = a.sourceName === 'Instagram'
            ? 'https://www.instagram.com/'
            : a.sourceName === 'X (Twitter)'
            ? 'https://twitter.com/'
            : undefined;

          try {
            const imgRes = await fetch(a.imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...(referer ? { 'Referer': referer } : {}),
              },
              signal: AbortSignal.timeout(5000),
            });
            if (imgRes.ok) {
              const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
              const buf = await imgRes.arrayBuffer();
              const base64 = Buffer.from(buf).toString('base64');
              imageData = `data:${contentType};base64,${base64}`;
            }
          } catch (e) { /* giữ URL gốc nếu fetch thất bại */ }
        }
        // Ngày thật từ scraper (RSS/HN/Reddit/arXiv có ngày chính xác).
        // Web-search (Quora/LinkedIn...) thường không rõ ngày → NULL → chỉ hiện ở filter "Tất cả".
        let publishedAt: string | null = null;
        if (a.publishedAt) {
          const d = new Date(a.publishedAt);
          if (!isNaN(d.getTime()) && d.getFullYear() > 2000) publishedAt = d.toISOString();
        }
        await sql`INSERT INTO articles (id, source_id, title, url, summary, original_image_url, published_at)
          VALUES (${id}, ${source.id}, ${a.title}, ${a.url}, ${a.summary}, ${imageData}, ${publishedAt})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch (e) { /* ignore duplicate URL */ }
    }
    return NextResponse.json({ success: true, count, found: allArticles.length, limit: maxArticles });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
