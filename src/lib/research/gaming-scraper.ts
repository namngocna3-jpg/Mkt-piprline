import Parser from 'rss-parser';
import type { ScrapedArticle } from './rss-scraper';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mkt-piprline/1.0' } });

// ===== Game News tổng (PC/Console/Mobile) — multi-platform =====
const NEWS_FEEDS = [
  { url: 'https://feeds.ign.com/ign/games-all', name: 'IGN' },
  { url: 'https://www.gamespot.com/feeds/mashup/', name: 'GameSpot' },
  { url: 'https://www.polygon.com/rss/index.xml', name: 'Polygon' },
  { url: 'https://www.eurogamer.net/?format=rss', name: 'Eurogamer' },
  { url: 'https://kotaku.com/rss', name: 'Kotaku' },
  { url: 'https://www.vg247.com/feed', name: 'VG247' },
  { url: 'https://www.gamesradar.com/all-articles/feed/', name: 'GamesRadar' },
];

// ===== PC Gaming + Steam =====
const PC_FEEDS = [
  { url: 'https://www.pcgamer.com/rss/', name: 'PC Gamer' },
  { url: 'https://www.rockpapershotgun.com/feed', name: 'Rock Paper Shotgun' },
  { url: 'https://store.steampowered.com/feeds/news/', name: 'Steam News' },
  { url: 'https://www.gamingonlinux.com/article_rss.php', name: 'GamingOnLinux' },
];

// ===== Mobile Gaming =====
const MOBILE_FEEDS = [
  { url: 'https://www.pocketgamer.com/rss/', name: 'PocketGamer' },
  { url: 'https://toucharcade.com/feed/', name: 'TouchArcade' },
  { url: 'https://www.droidgamers.com/feed/', name: 'DroidGamers' },
  { url: 'https://www.gamerant.com/feed/category/mobile-games/', name: 'GameRant Mobile' },
];

const MAX_AGE_HOURS = 72; // chỉ lấy bài < 3 ngày

async function scrapeFeeds(feeds: { url: string; name: string }[]): Promise<ScrapedArticle[]> {
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();

  const results = await Promise.allSettled(feeds.map(f => parser.parseURL(f.url).then(feed => ({ feed, source: f.name }))));

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { feed, source } = r.value;
    for (const item of (feed.items || []).slice(0, 15)) {
      const url = item.link || '';
      if (!url || seen.has(url)) continue;
      const ts = item.isoDate || item.pubDate;
      if (ts && new Date(ts).getTime() < cutoff) continue;
      seen.add(url);
      const text = String(item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').slice(0, 500);
      // ảnh: thử các trường phổ biến
      const enclosure = (item as any).enclosure?.url;
      const mediaContent = (item as any)['media:content']?.['$']?.url || (item as any)['media:thumbnail']?.['$']?.url;
      const imgFromContent = String(item.content || '').match(/<img[^>]+src=["']([^"']+)["']/)?.[1];
      out.push({
        title: item.title || '',
        url,
        summary: text,
        imageUrl: enclosure || mediaContent || imgFromContent || null,
        publishedAt: ts || new Date().toISOString(),
        sourceName: source,
      });
    }
  }
  return out.slice(0, 40);
}

export function scrapeGamingNews() { return scrapeFeeds(NEWS_FEEDS); }
export function scrapePcGaming() { return scrapeFeeds(PC_FEEDS); }
export function scrapeMobileGaming() { return scrapeFeeds(MOBILE_FEEDS); }
