import type { ScrapedArticle } from './rss-scraper';

const SUBREDDITS = [
  'artificial', 'OpenAI', 'ClaudeAI', 'singularity', 'LocalLLaMA',
  'MachineLearning', 'ArtificialInteligence', 'ChatGPT', 'PromptEngineering',
];

const MIN_UPVOTES = 50;

export async function scrapeReddit(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const cutoff = (Date.now() - 48 * 60 * 60 * 1000) / 1000;

  for (const sub of SUBREDDITS) {
    try {
      // Use old.reddit.com .json — works without OAuth for read-only queries.
      const url = `https://www.reddit.com/r/${sub}/top/.json?t=day&limit=15`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mkt-piprline/1.0 (research bot)',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const posts = json?.data?.children || [];
      for (const p of posts) {
        const d = p?.data;
        if (!d) continue;
        if (d.created_utc && d.created_utc < cutoff) continue;
        if ((d.ups || 0) < MIN_UPVOTES) continue;
        const u = d.url_overridden_by_dest || `https://reddit.com${d.permalink || ''}`;
        if (seen.has(u)) continue;
        seen.add(u);
        const img =
          d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ||
          (d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : null);
        out.push({
          title: d.title || '',
          url: u,
          summary: `r/${sub} · ${d.ups || 0} ↑ · ${d.num_comments || 0} comments\n${(d.selftext || '').slice(0, 400)}`,
          imageUrl: img || null,
          publishedAt: new Date((d.created_utc || 0) * 1000).toISOString(),
          sourceName: `Reddit r/${sub}`,
        });
      }
    } catch {}
  }
  return out.slice(0, 40);
}
