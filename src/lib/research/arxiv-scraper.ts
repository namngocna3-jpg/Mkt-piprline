import type { ScrapedArticle } from './rss-scraper';
import { parse } from 'node-html-parser';

const AI_CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'];

export async function scrapeArxiv(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();

  for (const cat of AI_CATEGORIES) {
    try {
      const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      // Atom feed parsing via node-html-parser (lowercase tags ok)
      const root = parse(xml);
      const entries = root.querySelectorAll('entry');
      for (const e of entries) {
        const id = e.querySelector('id')?.text || '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const title = (e.querySelector('title')?.text || '').replace(/\s+/g, ' ').trim();
        const summary = (e.querySelector('summary')?.text || '').replace(/\s+/g, ' ').trim();
        const published = e.querySelector('published')?.text || new Date().toISOString();
        const authors = e.querySelectorAll('author name').map((n: any) => n.text).slice(0, 3).join(', ');
        out.push({
          title,
          url: id,
          summary: `📄 arXiv ${cat} · ${authors}\n${summary.slice(0, 500)}`,
          imageUrl: null,
          publishedAt: published,
          sourceName: `arXiv ${cat}`,
        });
      }
    } catch {}
  }

  return out.slice(0, 30);
}
