import Parser from 'rss-parser';
import type { ScrapedArticle } from './rss-scraper';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mkt-piprline/1.0' } });

const TAGS = ['artificial-intelligence', 'machine-learning', 'chatgpt', 'large-language-models', 'ai-marketing', 'productivity'];

export async function scrapeMedium(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const cutoff = Date.now() - 5 * 24 * 60 * 60 * 1000;

  for (const tag of TAGS) {
    try {
      const feed = await parser.parseURL(`https://medium.com/feed/tag/${tag}`);
      for (const item of (feed.items || [])) {
        const url = item.link || '';
        if (!url || seen.has(url)) continue;
        const ts = item.isoDate || item.pubDate;
        if (ts && new Date(ts).getTime() < cutoff) continue;
        seen.add(url);
        const text = (item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').slice(0, 400);
        out.push({
          title: item.title || '',
          url,
          summary: `📝 #${tag} · by ${item.creator || 'Medium'}\n${text}`,
          imageUrl: null,
          publishedAt: ts || new Date().toISOString(),
          sourceName: `Medium · ${tag}`,
        });
      }
    } catch {}
  }
  return out.slice(0, 30);
}
