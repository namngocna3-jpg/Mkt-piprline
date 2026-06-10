import type { ScrapedArticle } from './rss-scraper';
import { getSetting } from '../settings';
import { webSearchAny } from '../webSearchProviders';

const AI_QUERIES = [
  'AI tool tutorial', 'AI agent build', 'ChatGPT update', 'Claude Sonnet',
  'Gemini AI demo', 'AI marketing strategy', 'AI workflow automation',
];

const isoSince = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

async function searchViaApi(apiKey: string): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const publishedAfter = isoSince(72);

  for (const q of AI_QUERIES) {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        q,
        type: 'video',
        order: 'viewCount',
        publishedAfter,
        maxResults: '10',
        relevanceLanguage: 'en',
        key: apiKey,
      });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      if (!res.ok) continue;
      const json = await res.json();
      for (const item of (json?.items || [])) {
        const vid = item.id?.videoId;
        if (!vid) continue;
        const url = `https://www.youtube.com/watch?v=${vid}`;
        if (seen.has(url)) continue;
        seen.add(url);
        const s = item.snippet || {};
        out.push({
          title: s.title || '',
          url,
          summary: `🎬 ${s.channelTitle || ''}\n${s.description || ''}`.slice(0, 500),
          imageUrl: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || null,
          publishedAt: s.publishedAt || new Date().toISOString(),
          sourceName: `YouTube · ${s.channelTitle || ''}`.slice(0, 80),
        });
      }
    } catch {}
  }
  return out;
}

async function searchViaRapidApi(apiKey: string): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const host = (await getSetting('RAPIDAPI_YOUTUBE_HOST')) || 'youtube-v311.p.rapidapi.com';

  for (const q of AI_QUERIES) {
    try {
      const url = `https://${host}/search?part=snippet&q=${encodeURIComponent(q)}&type=video&order=viewCount&maxResults=10`;
      const res = await fetch(url, { headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': apiKey } });
      if (!res.ok) continue;
      const json = await res.json();
      const items = json?.items || json?.contents || [];
      for (const item of items) {
        const vid = item?.id?.videoId || item?.video?.videoId;
        if (!vid) continue;
        const url2 = `https://www.youtube.com/watch?v=${vid}`;
        if (seen.has(url2)) continue;
        seen.add(url2);
        const s = item?.snippet || item?.video || {};
        out.push({
          title: s.title || '',
          url: url2,
          summary: `🎬 ${s.channelTitle || ''}\n${s.description || ''}`.slice(0, 500),
          imageUrl: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || null,
          publishedAt: s.publishedAt || new Date().toISOString(),
          sourceName: `YouTube · ${s.channelTitle || ''}`.slice(0, 80),
        });
      }
    } catch {}
  }
  return out;
}

async function searchViaWebRouter(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const q of AI_QUERIES) {
    try {
      const results = await webSearchAny(`site:youtube.com ${q}`, { mode: 'web', count: 5 });
      for (const r of results) {
        if (!r.url || seen.has(r.url) || !/youtube\.com\/(watch|shorts)/.test(r.url)) continue;
        seen.add(r.url);
        out.push({
          title: r.title,
          url: r.url,
          summary: `🎬 (via ${r.provider})\n${r.description || ''}`.slice(0, 500),
          imageUrl: r.imageUrl ?? null,
          publishedAt: r.publishedAt || new Date().toISOString(),
          sourceName: 'YouTube',
        });
      }
    } catch {}
  }
  return out;
}

export async function scrapeYoutube(): Promise<ScrapedArticle[]> {
  const ytKey = await getSetting('YOUTUBE_API_KEY');
  if (ytKey) {
    const apiResults = await searchViaApi(ytKey);
    if (apiResults.length) return apiResults.slice(0, 30);
  }
  const rapidKey = await getSetting('RAPID_API_KEY');
  if (rapidKey) {
    const rapidResults = await searchViaRapidApi(rapidKey);
    if (rapidResults.length) return rapidResults.slice(0, 30);
  }
  // Last resort: web search router (Brave / Tavily / DDG / Wiki)
  return (await searchViaWebRouter()).slice(0, 30);
}
