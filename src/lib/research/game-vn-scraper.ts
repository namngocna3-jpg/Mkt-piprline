import Parser from 'rss-parser';
import type { ScrapedArticle } from './rss-scraper';
import { getSetting } from '../settings';
import { webSearchAny } from '../webSearchProviders';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mkt-piprline/1.0' } });

// ===== Báo game Việt — tin Valorant/LMHT/Liên Quân... bằng TIẾNG VIỆT =====
const VN_FEEDS = [
  { url: 'https://gamek.vn/esport.rss', name: 'GameK eSport' },
  { url: 'https://gamek.vn/trang-chu.rss', name: 'GameK' },
  { url: 'https://gamek.vn/mobile.rss', name: 'GameK Mobile' },
  { url: 'https://2game.vn/feed', name: '2Game' },
  { url: 'https://motgame.vn/feed', name: 'Mọt Game' },
];

const MAX_AGE_HOURS = 96;

function pickImage(item: any): string | null {
  return (item?.enclosure?.url)
    || item?.['media:content']?.['$']?.url
    || item?.['media:thumbnail']?.['$']?.url
    || String(item?.content || '').match(/<img[^>]+src=["']([^"']+)["']/)?.[1]
    || null;
}

async function scrapeFeeds(feeds: { url: string; name: string }[], cap = 40): Promise<ScrapedArticle[]> {
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const results = await Promise.allSettled(feeds.map(f => parser.parseURL(f.url).then(feed => ({ feed, source: f.name }))));
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { feed, source } = r.value;
    for (const item of (feed.items || []).slice(0, 20)) {
      const url = item.link || '';
      if (!url || seen.has(url)) continue;
      const ts = item.isoDate || item.pubDate;
      if (ts && new Date(ts).getTime() < cutoff) continue;
      seen.add(url);
      out.push({
        title: item.title || '',
        url,
        summary: String(item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').slice(0, 500),
        imageUrl: pickImage(item),
        publishedAt: ts || new Date().toISOString(),
        sourceName: source,
      });
    }
  }
  return out.slice(0, cap);
}

export function scrapeVnGaming() { return scrapeFeeds(VN_FEEDS); }

// ===== Update theo TỪNG TỰA GAME (qua web search, ưu tiên tiếng Việt) =====
const TITLES: { name: string; query: string }[] = [
  { name: 'Valorant', query: 'Valorant cập nhật bản mới battle pass skin patch' },
  { name: 'LMHT', query: 'Liên Minh Huyền Thoại cập nhật phiên bản mới patch notes' },
  { name: 'Liên Quân', query: 'Liên Quân Mobile cập nhật phiên bản tướng mới skin' },
  { name: 'Tốc Chiến', query: 'Tốc Chiến Wild Rift cập nhật phiên bản mới' },
  { name: 'Genshin', query: 'Genshin Impact bản cập nhật mới banner nhân vật' },
  { name: 'Free Fire', query: 'Free Fire cập nhật mới nhất sự kiện skin' },
  { name: 'PUBG Mobile', query: 'PUBG Mobile cập nhật phiên bản mới' },
  { name: 'Liên Minh Tốc Chiến', query: 'Riot Games Việt Nam sự kiện cập nhật game' },
];

export async function scrapeGameTitles(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const results = await Promise.allSettled(
    TITLES.map(t => webSearchAny(t.query, { mode: 'web', count: 4, freshness: 'week' }).then(rs => ({ t, rs })))
  );
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { t, rs } = r.value;
    for (const item of rs) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      out.push({
        title: `[${t.name}] ${item.title}`,
        url: item.url,
        summary: `🎮 ${t.name} (via ${item.provider})\n${item.description || ''}`.slice(0, 500),
        imageUrl: item.imageUrl ?? null,
        publishedAt: item.publishedAt || '',
        sourceName: `Game · ${t.name}`,
      });
    }
  }
  return out.slice(0, 40);
}

// ===== Nguồn RSS tự thêm (user dán URL — vd VNG community, trang game yêu thích) =====
export async function scrapeCustomFeeds(): Promise<ScrapedArticle[]> {
  const raw = (await getSetting('CUSTOM_RSS_FEEDS')) || '';
  const urls = raw.split(/[\n,]+/).map(u => u.trim()).filter(Boolean).slice(0, 10);
  if (!urls.length) return [];
  const feeds = urls.map(u => ({ url: u, name: '📌 ' + (u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) }));
  return scrapeFeeds(feeds, 50);
}
