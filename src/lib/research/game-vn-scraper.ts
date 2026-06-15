import Parser from 'rss-parser';
import { parse as parseHtml } from 'node-html-parser';
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

export async function scrapeGameTitles(customTitles?: string[]): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  // Nếu user nhập tên game riêng → ưu tiên dùng, build query tiếng Việt
  const titleList = (customTitles && customTitles.length)
    ? customTitles.map(name => ({ name, query: `${name} cập nhật mới nhất phiên bản sự kiện skin tướng` }))
    : TITLES;
  const results = await Promise.allSettled(
    titleList.map(t => webSearchAny(t.query, { mode: 'web', count: 4, freshness: 'week' }).then(rs => ({ t, rs })))
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

// Fetch 1 URL thường (không phải RSS) → trích 1 bài từ meta og:/title.
async function scrapePageAsArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mkt-piprline/1.0)' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = await res.text();
    const root = parseHtml(html);
    const meta = (sel: string, attr = 'content') => root.querySelector(sel)?.getAttribute(attr) || '';
    const title = meta('meta[property="og:title"]') || root.querySelector('title')?.text?.trim() || url;
    const desc = meta('meta[property="og:description"]') || meta('meta[name="description"]') || '';
    const img = meta('meta[property="og:image"]') || null;
    const domain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return { title, url, summary: desc.slice(0, 500), imageUrl: img, publishedAt: '', sourceName: '📌 ' + domain };
  } catch { return null; }
}

// ===== Nguồn tự thêm: RSS hoặc link thường. inline (dán ở Pipeline) gộp với setting. =====
export async function scrapeCustomFeeds(inline?: string): Promise<ScrapedArticle[]> {
  const fromSetting = (await getSetting('CUSTOM_RSS_FEEDS')) || '';
  const raw = [inline || '', fromSetting].filter(Boolean).join('\n');
  const urls = Array.from(new Set(raw.split(/[\n,\s]+/).map(u => u.trim()).filter(u => /^https?:\/\//.test(u)))).slice(0, 12);
  if (!urls.length) return [];

  const out: ScrapedArticle[] = [];
  await Promise.allSettled(urls.map(async (u) => {
    // Thử RSS trước
    try {
      const feed = await parser.parseURL(u);
      if (feed?.items?.length) {
        const name = '📌 ' + u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        for (const item of feed.items.slice(0, 15)) {
          if (!item.link) continue;
          out.push({
            title: item.title || '', url: item.link,
            summary: String(item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').slice(0, 500),
            imageUrl: pickImage(item), publishedAt: item.isoDate || item.pubDate || new Date().toISOString(), sourceName: name,
          });
        }
        return;
      }
    } catch { /* không phải RSS → thử page */ }
    const page = await scrapePageAsArticle(u);
    if (page) out.push(page);
  }));
  return out.slice(0, 50);
}
