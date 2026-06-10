import type { ScrapedArticle } from './rss-scraper';
import { getSetting } from '../settings';
import { webSearchAny } from '../webSearchProviders';

const HASHTAGS = ['aitools', 'aitechnology', 'chatgpt', 'aimarketing', 'aitips'];

async function searchViaRapidApi(apiKey: string): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const host = (await getSetting('RAPIDAPI_TIKTOK_HOST')) || 'tiktok-scraper7.p.rapidapi.com';

  for (const tag of HASHTAGS) {
    try {
      const url = `https://${host}/feed/search?keywords=${encodeURIComponent(tag)}&count=10&cursor=0&region=US&publish_time=0&sort_type=0`;
      const res = await fetch(url, { headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': apiKey } });
      if (!res.ok) continue;
      const json = await res.json();
      const items = json?.data?.videos || json?.videos || json?.data || [];
      for (const v of items) {
        const vid = v.video_id || v.aweme_id || v.id;
        const author = v.author?.unique_id || v.author?.nickname || 'tiktok';
        const url2 = v.play_url || `https://www.tiktok.com/@${author}/video/${vid}`;
        if (!vid || seen.has(url2)) continue;
        seen.add(url2);
        out.push({
          title: `@${author} — ${(v.title || v.desc || '').slice(0, 80)}`,
          url: url2,
          summary: `🎵 ${(v.digg_count || 0).toLocaleString()} ❤ · ${(v.play_count || 0).toLocaleString()} views\n#${tag}\n${(v.title || v.desc || '').slice(0, 300)}`,
          imageUrl: v.cover || v.origin_cover || null,
          publishedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : new Date().toISOString(),
          sourceName: `TikTok #${tag}`,
        });
      }
    } catch {}
  }
  return out;
}

async function searchViaWebRouter(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const tag of HASHTAGS) {
    try {
      const results = await webSearchAny(`site:tiktok.com ${tag} AI`, { mode: 'web', count: 5 });
      for (const r of results) {
        if (!r.url || seen.has(r.url) || !/tiktok\.com\/@[\w.]+\/video/.test(r.url)) continue;
        seen.add(r.url);
        out.push({
          title: r.title,
          url: r.url,
          summary: `🎵 (via ${r.provider})\n#${tag}\n${r.description || ''}`.slice(0, 500),
          imageUrl: r.imageUrl ?? null,
          publishedAt: r.publishedAt || new Date().toISOString(),
          sourceName: `TikTok #${tag}`,
        });
      }
    } catch {}
  }
  return out;
}

export async function scrapeTiktok(): Promise<ScrapedArticle[]> {
  const rapidKey = await getSetting('RAPID_API_KEY');
  if (rapidKey) {
    const rapidResults = await searchViaRapidApi(rapidKey);
    if (rapidResults.length) return rapidResults.slice(0, 30);
  }
  return (await searchViaWebRouter()).slice(0, 30);
}
