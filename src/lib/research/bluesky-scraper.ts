import type { ScrapedArticle } from './rss-scraper';

const QUERIES = ['AI tools', 'LLM', 'ChatGPT', 'Claude AI', 'AI agent', 'AI marketing'];

export async function scrapeBluesky(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  for (const q of QUERIES) {
    try {
      const params = new URLSearchParams({ q, sort: 'top', since, limit: '20' });
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0' } });
      if (!res.ok) continue;
      const json = await res.json();
      for (const p of (json?.posts || [])) {
        const did = p.author?.did || '';
        const rkey = (p.uri || '').split('/').pop();
        const handle = p.author?.handle || '';
        const url2 = handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : p.uri;
        if (!url2 || seen.has(url2)) continue;
        if ((p.likeCount || 0) < 5) continue;
        seen.add(url2);
        const img = p.embed?.images?.[0]?.thumb || p.embed?.media?.images?.[0]?.thumb || null;
        out.push({
          title: `@${handle} — ${p.likeCount || 0} ★ · ${p.repostCount || 0} ↻`,
          url: url2,
          summary: `🦋 ${q}\n${String(p.record?.text || '').slice(0, 400)}`,
          imageUrl: img,
          publishedAt: p.record?.createdAt || new Date().toISOString(),
          sourceName: 'Bluesky',
        });
      }
    } catch {}
  }
  return out.slice(0, 30);
}
