import type { ScrapedArticle } from './rss-scraper';

const HN_QUERIES = [
  'AI', 'LLM', 'GPT', 'Claude', 'Gemini', 'AI tool', 'AI agent',
  'generative AI', 'AI startup', 'AI launch',
];

export async function scrapeHackerNews(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const since = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000);

  for (const q of HN_QUERIES) {
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since},points>20&hitsPerPage=10`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0' } });
      if (!res.ok) continue;
      const json = await res.json();
      for (const hit of (json?.hits || [])) {
        const u = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        if (seen.has(u)) continue;
        seen.add(u);
        out.push({
          title: hit.title || hit.story_title || '',
          url: u,
          summary: `${hit.points || 0} points · ${hit.num_comments || 0} comments | by ${hit.author || 'unknown'}\n${(hit.story_text || hit._highlightResult?.story_text?.value || '').replace(/<[^>]+>/g, '').slice(0, 400)}`,
          imageUrl: null,
          publishedAt: hit.created_at || new Date().toISOString(),
          sourceName: 'Hacker News',
        });
      }
    } catch {}
  }
  return out.slice(0, 30);
}
