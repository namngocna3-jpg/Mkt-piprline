import type { ScrapedArticle } from './rss-scraper';

export async function scrapeLobsters(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  try {
    const res = await fetch('https://lobste.rs/hottest.json', {
      headers: { 'User-Agent': 'Mkt-piprline/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return out;
    const arr = await res.json();
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    for (const s of (arr || [])) {
      const url = s.url || s.short_id_url;
      if (!url || seen.has(url)) continue;
      const ts = s.created_at;
      if (ts && new Date(ts).getTime() < cutoff) continue;
      const tags = (s.tags || []).join(',');
      if (!/ai|llm|gpt|ml|programming|practices|tech/.test(tags.toLowerCase())) continue;
      seen.add(url);
      out.push({
        title: s.title || '',
        url,
        summary: `🦞 ${s.score || 0} pts · ${s.comment_count || 0} comments · tags: ${tags}\n${(s.description || '').slice(0, 300)}`,
        imageUrl: null,
        publishedAt: ts || new Date().toISOString(),
        sourceName: 'Lobsters',
      });
    }
  } catch {}
  return out.slice(0, 20);
}
