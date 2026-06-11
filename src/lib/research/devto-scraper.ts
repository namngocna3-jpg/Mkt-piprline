import type { ScrapedArticle } from './rss-scraper';

const TAGS = ['ai', 'machinelearning', 'chatgpt', 'llm', 'productivity', 'webdev'];

export async function scrapeDevto(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const cutoff = Date.now() - 5 * 24 * 60 * 60 * 1000;

  for (const tag of TAGS) {
    try {
      const res = await fetch(`https://dev.to/api/articles?tag=${tag}&top=2&per_page=20`, {
        headers: { 'User-Agent': 'Mkt-piprline/1.0', 'Accept': 'application/json' },
      });
      if (!res.ok) continue;
      const arr = await res.json();
      for (const a of (arr || [])) {
        if (!a.url || seen.has(a.url)) continue;
        if (a.published_at && new Date(a.published_at).getTime() < cutoff) continue;
        if ((a.positive_reactions_count || 0) < 5) continue;
        seen.add(a.url);
        out.push({
          title: a.title || '',
          url: a.url,
          summary: `💻 #${tag} · ${a.positive_reactions_count || 0} ❤️ · by ${a.user?.username || 'devto'}\n${String(a.description || '').slice(0, 400)}`,
          imageUrl: a.cover_image || a.social_image || null,
          publishedAt: a.published_at || new Date().toISOString(),
          sourceName: `Dev.to · ${tag}`,
        });
      }
    } catch {}
  }
  return out.slice(0, 30);
}
