import type { ScrapedArticle } from './rss-scraper';

const INSTANCES = ['mastodon.social', 'mas.to', 'hachyderm.io'];
const HASHTAGS = ['ai', 'llm', 'chatgpt', 'aitools', 'machinelearning'];

export async function scrapeMastodon(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;

  for (const instance of INSTANCES) {
    for (const tag of HASHTAGS) {
      try {
        const url = `https://${instance}/api/v1/timelines/tag/${tag}?limit=20`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0' } });
        if (!res.ok) continue;
        const arr = await res.json();
        for (const p of (arr || [])) {
          if (!p?.url || seen.has(p.url)) continue;
          if (p.created_at && new Date(p.created_at).getTime() < cutoff) continue;
          if ((p.favourites_count || 0) < 5 && (p.reblogs_count || 0) < 2) continue;
          seen.add(p.url);
          const txt = String(p.content || '').replace(/<[^>]+>/g, '');
          const img = p.media_attachments?.[0]?.preview_url || p.media_attachments?.[0]?.url || null;
          out.push({
            title: `@${p.account?.acct || '?'} — ${p.favourites_count || 0} ★ · ${p.reblogs_count || 0} ↻`,
            url: p.url,
            summary: `🐘 #${tag}\n${txt.slice(0, 400)}`,
            imageUrl: img,
            publishedAt: p.created_at || new Date().toISOString(),
            sourceName: `Mastodon · ${instance}`,
          });
        }
      } catch {}
    }
  }
  return out.slice(0, 30);
}
