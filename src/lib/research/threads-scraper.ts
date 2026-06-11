import type { ScrapedArticle } from './rss-scraper';
import { getSetting } from '../settings';
import { webSearchAny } from '../webSearchProviders';

const QUERIES = ['AI tools', 'AI marketing', 'ChatGPT tips', 'AI workflow', 'AI agent'];

async function searchViaRapidApi(apiKey: string): Promise<ScrapedArticle[]> {
  const host = (await getSetting('RAPIDAPI_THREADS_HOST')) || 'threads-api4.p.rapidapi.com';
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const q of QUERIES) {
    try {
      const url = `https://${host}/search?query=${encodeURIComponent(q)}&search_type=top`;
      const res = await fetch(url, { headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': apiKey } });
      if (!res.ok) continue;
      const json = await res.json();
      const items = json?.data?.posts || json?.posts || json?.items || [];
      for (const p of items) {
        const code = p.code || p.id || p.thread_id;
        const author = p.user?.username || p.author?.username || 'threads';
        const url2 = code ? `https://www.threads.net/@${author}/post/${code}` : '';
        if (!url2 || seen.has(url2)) continue;
        seen.add(url2);
        const img = p.image_versions2?.candidates?.[0]?.url || p.preview_url || null;
        out.push({
          title: `@${author} — ${(p.like_count || 0).toLocaleString()} ★`,
          url: url2,
          summary: `🧵 ${q}\n${String(p.caption?.text || p.text || '').slice(0, 400)}`,
          imageUrl: img,
          publishedAt: p.taken_at ? new Date(p.taken_at * 1000).toISOString() : new Date().toISOString(),
          sourceName: 'Threads',
        });
      }
    } catch {}
  }
  return out;
}

async function searchViaWebRouter(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const q of QUERIES) {
    try {
      const results = await webSearchAny(`site:threads.net ${q}`, { count: 5 });
      for (const r of results) {
        if (!r.url || seen.has(r.url) || !/threads\.net/.test(r.url)) continue;
        seen.add(r.url);
        out.push({
          title: r.title,
          url: r.url,
          summary: `🧵 (via ${r.provider}) ${q}\n${r.description || ''}`.slice(0, 500),
          imageUrl: r.imageUrl ?? null,
          publishedAt: r.publishedAt || new Date().toISOString(),
          sourceName: 'Threads',
        });
      }
    } catch {}
  }
  return out;
}

export async function scrapeThreads(): Promise<ScrapedArticle[]> {
  const k = await getSetting('RAPID_API_KEY');
  if (k) {
    const r = await searchViaRapidApi(k);
    if (r.length) return r.slice(0, 30);
  }
  return (await searchViaWebRouter()).slice(0, 30);
}
