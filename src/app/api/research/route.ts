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
import { scrapeQuora } from '@/lib/research/quora-scraper';
import { scrapeGamingNews, scrapePcGaming, scrapeMobileGaming } from '@/lib/research/gaming-scraper';
import { scrapeVnGaming, scrapeGameTitles, scrapeCustomFeeds } from '@/lib/research/game-vn-scraper';
import { scrapeGoogleNews } from '@/lib/research/google-news-scraper';
import { scrapeStackExchange } from '@/lib/research/stackexchange-scraper';
import { scrapeWikipedia } from '@/lib/research/wikipedia-scraper';
import { scrapeLemmy } from '@/lib/research/lemmy-scraper';
import { cleanText } from '@/lib/textClean';

export const maxDuration = 60;

type Source = 'all' | 'news' | 'x' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin'
  | 'reddit' | 'hackernews' | 'github' | 'arxiv' | 'producthunt'
  | 'mastodon' | 'bluesky' | 'medium' | 'devto' | 'lobsters'
  | 'quora' | 'googlenews' | 'stackexchange' | 'wikipedia' | 'lemmy'
  | 'gaming' | 'gaming_pc' | 'gaming_mobile' | 'gaming_vn' | 'gaming_titles' | 'custom';

const include = (filter: string, key: Source) => filter === 'all' || filter === key;

// Giới hạn thời gian mỗi scraper — 1 nguồn chậm không kéo cả scan timeout.
function withTimeout(p: Promise<ScrapedArticle[]>, ms = 22000): Promise<ScrapedArticle[]> {
  return Promise.race([
    p.catch(() => [] as ScrapedArticle[]),
    new Promise<ScrapedArticle[]>((resolve) => setTimeout(() => resolve([]), ms)),
  ]);
}

export async function POST(req: Request) {
  try {
    // Khởi tạo Database nếu chưa có
    try {
      await initDb();
      await seedDb();
    } catch(e) { console.error("DB Init Error:", e) }

    const { sourceFilter, limit, gameTitles, customFeeds, newsQuery } = await req.json();
    const newsQ = String(newsQuery || '').trim();
    const filter = (sourceFilter || 'all') as string;
    const maxArticles = Math.max(1, Math.min(Number(limit) || 20, 100)); // giới hạn số bài lấy về
    const titlesArr = String(gameTitles || '').split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 10);
    const customStr = String(customFeeds || '');

    // Chạy parallel để tiết kiệm thời gian
    const tasks: Array<Promise<ScrapedArticle[]>> = [];

    if (include(filter, 'news')) {
      tasks.push(withTimeout((async () => {
        const rssSources = await sql`SELECT name, rss_url FROM sources WHERE type = 'rss' AND active = 1`;
        return scrapeAllRSSFeeds(rssSources as any);
      })()));
    }
    if (include(filter, 'x')) tasks.push(withTimeout(searchSocialMedia('x')));
    if (include(filter, 'instagram')) tasks.push(withTimeout(searchSocialMedia('instagram')));
    if (include(filter, 'tiktok')) tasks.push(withTimeout(scrapeTiktok()));
    if (include(filter, 'youtube')) tasks.push(withTimeout(scrapeYoutube()));
    if (include(filter, 'linkedin')) tasks.push(withTimeout(scrapeLinkedIn()));
    if (include(filter, 'reddit')) tasks.push(withTimeout(scrapeReddit()));
    if (include(filter, 'hackernews')) tasks.push(withTimeout(scrapeHackerNews()));
    if (include(filter, 'github')) tasks.push(withTimeout(scrapeGithubTrending()));
    if (include(filter, 'arxiv')) tasks.push(withTimeout(scrapeArxiv()));
    if (include(filter, 'producthunt')) tasks.push(withTimeout(scrapeProductHunt()));
    if (include(filter, 'mastodon')) tasks.push(withTimeout(scrapeMastodon()));
    if (include(filter, 'bluesky')) tasks.push(withTimeout(scrapeBluesky()));
    if (include(filter, 'medium')) tasks.push(withTimeout(scrapeMedium()));
    if (include(filter, 'devto')) tasks.push(withTimeout(scrapeDevto()));
    if (include(filter, 'lobsters')) tasks.push(withTimeout(scrapeLobsters()));
    if (include(filter, 'quora')) tasks.push(withTimeout(scrapeQuora()));
    if (include(filter, 'googlenews')) tasks.push(withTimeout(scrapeGoogleNews(newsQ || undefined)));
    if (include(filter, 'stackexchange')) tasks.push(withTimeout(scrapeStackExchange()));
    if (include(filter, 'wikipedia')) tasks.push(withTimeout(scrapeWikipedia()));
    if (include(filter, 'lemmy')) tasks.push(withTimeout(scrapeLemmy()));
    if (include(filter, 'gaming')) tasks.push(withTimeout(scrapeGamingNews()));
    if (include(filter, 'gaming_pc')) tasks.push(withTimeout(scrapePcGaming()));
    if (include(filter, 'gaming_mobile')) tasks.push(withTimeout(scrapeMobileGaming()));
    if (include(filter, 'gaming_vn')) tasks.push(withTimeout(scrapeVnGaming()));
    if (include(filter, 'gaming_titles')) tasks.push(withTimeout(scrapeGameTitles(titlesArr.length ? titlesArr : undefined)));
    if (include(filter, 'custom')) tasks.push(withTimeout(scrapeCustomFeeds(customStr)));

    const settled = await Promise.allSettled(tasks);
    const rawArticles: ScrapedArticle[] = settled
      .filter((r): r is PromiseFulfilledResult<ScrapedArticle[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Lọc nội dung MỎNG: bỏ bài tiêu đề/nội dung quá ngắn (không đủ để viết).
    const meaningful = (a: ScrapedArticle) => {
      const title = cleanText(a.title);
      const body = cleanText(a.summary).replace(/^[^\n]*\n/, ''); // bỏ dòng tiền tố emoji/query
      return title.length >= 12 && (body.length >= 25 || cleanText(a.summary).length >= 40);
    };
    const allArticles = rawArticles.filter(meaningful);

    // Ưu tiên bài có ngày MỚI nhất; bài không rõ ngày xếp cuối. Rồi cắt theo maxArticles.
    const ts = (a: ScrapedArticle) => {
      if (!a.publishedAt) return 0;
      const t = new Date(a.publishedAt).getTime();
      return isNaN(t) ? 0 : t;
    };
    const articles = allArticles
      .sort((x, y) => ts(y) - ts(x))
      .slice(0, maxArticles);

    // Dọn hàng đợi bài CHƯA xử lý của lần scan trước → step 2 chỉ hiện bài lần này (đỡ ngập).
    try { await sql`DELETE FROM articles WHERE status = 'new'`; } catch {}

    // Fetch ảnh SONG SONG (trước đây tuần tự → rất chậm, dễ timeout)
    const fetchImage = async (a: ScrapedArticle): Promise<string | null> => {
      if (!a.imageUrl || !a.imageUrl.startsWith('http')) return a.imageUrl || null;
      const referer = a.sourceName === 'Instagram' ? 'https://www.instagram.com/'
        : a.sourceName === 'X (Twitter)' ? 'https://twitter.com/' : undefined;
      try {
        const imgRes = await fetch(a.imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...(referer ? { 'Referer': referer } : {}),
          },
          signal: AbortSignal.timeout(4000),
        });
        if (!imgRes.ok) return a.imageUrl;
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buf = await imgRes.arrayBuffer();
        return `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`;
      } catch { return a.imageUrl; }
    };
    const images = await Promise.all(articles.map(fetchImage));

    let count = 0;
    for (let i = 0; i < articles.length; i++) {
      const a = articles[i];
      let [source] = await sql`SELECT id FROM sources WHERE name = ${a.sourceName}`;
      if (!source) {
        const newSourceId = "s_" + Math.random().toString(36).substring(7);
        await sql`INSERT INTO sources (id, name, type) VALUES (${newSourceId}, ${a.sourceName}, 'social')`;
        source = { id: newSourceId };
      }
      try {
        const id = "a_" + Math.random().toString(36).substring(7);
        let publishedAt: string | null = null;
        if (a.publishedAt) {
          const d = new Date(a.publishedAt);
          if (!isNaN(d.getTime()) && d.getFullYear() > 2000) publishedAt = d.toISOString();
        }
        await sql`INSERT INTO articles (id, source_id, title, url, summary, original_image_url, published_at)
          VALUES (${id}, ${source.id}, ${a.title}, ${a.url}, ${a.summary}, ${images[i]}, ${publishedAt})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch (e) { /* ignore duplicate URL */ }
    }
    return NextResponse.json({ success: true, count, found: allArticles.length, limit: maxArticles });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
