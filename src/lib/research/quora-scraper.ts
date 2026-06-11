import type { ScrapedArticle } from './rss-scraper';
import { getSetting } from '../settings';
import { webSearchAny } from '../webSearchProviders';

const QUERIES = ['best AI tools', 'how to use ChatGPT', 'AI for marketing', 'AI agent example', 'LLM comparison'];

async function searchViaRapidApi(apiKey: string): Promise<ScrapedArticle[]> {
  const host = (await getSetting('RAPIDAPI_QUORA_HOST')) || 'quora-scraper.p.rapidapi.com';
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const q of QUERIES) {
    try {
      const url = `https://${host}/search?query=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': apiKey } });
      if (!res.ok) continue;
      const json = await res.json();
      const items = json?.data || json?.results || [];
      for (const r of items) {
        const url2 = r.url || r.link || '';
        if (!url2 || seen.has(url2)) continue;
        seen.add(url2);
        out.push({
          title: r.title || r.question || q,
          url: url2,
          summary: `❓ Quora · ${q}\n${String(r.answer || r.snippet || r.description || '').slice(0, 400)}`,
          imageUrl: r.image || null,
          publishedAt: r.date || new Date().toISOString(),
          sourceName: 'Quora',
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
      const results = await webSearchAny(`site:quora.com ${q}`, { count: 5 });
      for (const r of results) {
        if (!r.url || seen.has(r.url) || !/quora\.com/.test(r.url)) continue;
        seen.add(r.url);
        out.push({
          title: r.title,
          url: r.url,
          summary: `❓ (via ${r.provider}) ${q}\n${r.description || ''}`.slice(0, 500),
          imageUrl: r.imageUrl ?? null,
          publishedAt: r.publishedAt || new Date().toISOString(),
          sourceName: 'Quora',
        });
      }
    } catch {}
  }
  return out;
}

export async function scrapeQuora(): Promise<ScrapedArticle[]> {
  const k = await getSetting('RAPID_API_KEY');
  if (k) {
    const r = await searchViaRapidApi(k);
    if (r.length) return r.slice(0, 30);
  }
  return (await searchViaWebRouter()).slice(0, 30);
}
