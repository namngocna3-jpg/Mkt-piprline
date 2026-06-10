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

export const maxDuration = 60; // Thêm dòng này để Vercel không bị Timeout

type Source = 'all' | 'news' | 'x' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin'
  | 'reddit' | 'hackernews' | 'github' | 'arxiv' | 'producthunt';

const include = (filter: string, key: Source) => filter === 'all' || filter === key;

export async function POST(req: Request) {
  try {
    // Khởi tạo Database nếu chưa có
    try {
      await initDb();
      await seedDb();
    } catch(e) { console.error("DB Init Error:", e) }

    const { sourceFilter } = await req.json();
    const filter = (sourceFilter || 'all') as string;

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

    const settled = await Promise.allSettled(tasks);
    const articles: ScrapedArticle[] = settled
      .filter((r): r is PromiseFulfilledResult<ScrapedArticle[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

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
        await sql`INSERT INTO articles (id, source_id, title, url, summary, original_image_url) VALUES (${id}, ${source.id}, ${a.title}, ${a.url}, ${a.summary}, ${imageData}) ON CONFLICT DO NOTHING`;
        count++;
      } catch (e) { /* ignore duplicate URL */ }
    }
    return NextResponse.json({ success: true, count });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
