import type { ScrapedArticle } from './rss-scraper';
import { webSearchAny } from '../webSearchProviders';

const QUERIES = [
  'AI tools new launch',
  'AI agent enterprise',
  'AI marketing case study',
  'AI workflow productivity',
  'ChatGPT business',
];

export async function scrapeLinkedIn(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();

  for (const q of QUERIES) {
    try {
      const results = await webSearchAny(`site:linkedin.com/posts OR site:linkedin.com/pulse ${q}`, { mode: 'web', count: 8 });
      for (const r of results) {
        if (!r.url || seen.has(r.url)) continue;
        if (!/linkedin\.com\/(posts|pulse)/i.test(r.url)) continue;
        seen.add(r.url);
        out.push({
          title: r.title,
          url: r.url,
          summary: `💼 (via ${r.provider})\n${r.description || ''}`.slice(0, 500),
          imageUrl: r.imageUrl ?? null,
          publishedAt: r.publishedAt || new Date().toISOString(),
          sourceName: 'LinkedIn',
        });
      }
    } catch {}
  }

  return out.slice(0, 30);
}
