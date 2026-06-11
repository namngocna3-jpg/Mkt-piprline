import type { ScrapedArticle } from './rss-scraper';
import { getSetting } from '../settings';
import { webSearchAny } from '../webSearchProviders';

const QUERIES = ['AI marketing', 'AI tools', 'ChatGPT prompts', 'AI design', 'AI infographic'];

async function searchViaRapidApi(apiKey: string): Promise<ScrapedArticle[]> {
  const host = (await getSetting('RAPIDAPI_PINTEREST_HOST')) || 'pinterest-scraper.p.rapidapi.com';
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const q of QUERIES) {
    try {
      const url = `https://${host}/search?query=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': apiKey } });
      if (!res.ok) continue;
      const json = await res.json();
      const items = json?.data?.results || json?.results || json?.data || [];
      for (const p of items) {
        const url2 = p.url || p.link || (p.id ? `https://pinterest.com/pin/${p.id}/` : '');
        if (!url2 || seen.has(url2)) continue;
        seen.add(url2);
        const img = p.images?.orig?.url || p.image_url || p.image || null;
        out.push({
          title: (p.title || p.grid_title || `Pinterest · ${q}`).slice(0, 100),
          url: url2,
          summary: `📌 ${q}\n${String(p.description || '').slice(0, 400)}`,
          imageUrl: img,
          publishedAt: new Date().toISOString(),
          sourceName: 'Pinterest',
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
      const results = await webSearchAny(`site:pinterest.com/pin ${q}`, { count: 5 });
      for (const r of results) {
        if (!r.url || seen.has(r.url) || !/pinterest\.com\/pin/.test(r.url)) continue;
        seen.add(r.url);
        out.push({
          title: r.title,
          url: r.url,
          summary: `📌 (via ${r.provider}) ${q}\n${r.description || ''}`.slice(0, 500),
          imageUrl: r.imageUrl ?? null,
          publishedAt: r.publishedAt || new Date().toISOString(),
          sourceName: 'Pinterest',
        });
      }
    } catch {}
  }
  return out;
}

export async function scrapePinterest(): Promise<ScrapedArticle[]> {
  const k = await getSetting('RAPID_API_KEY');
  if (k) {
    const r = await searchViaRapidApi(k);
    if (r.length) return r.slice(0, 30);
  }
  return (await searchViaWebRouter()).slice(0, 30);
}
