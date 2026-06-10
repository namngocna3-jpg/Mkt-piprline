import type { ScrapedArticle } from './rss-scraper';
import Parser from 'rss-parser';
import { getSetting } from '../settings';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mkt-piprline/1.0' } });

const AI_TOPICS = ['artificial-intelligence', 'developer-tools', 'productivity', 'marketing'];

async function scrapeViaRss(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  for (const topic of AI_TOPICS) {
    try {
      // Product Hunt provides RSS feeds per topic without auth
      const feed = await parser.parseURL(`https://www.producthunt.com/feed?category=${topic}`);
      for (const item of (feed.items || [])) {
        const u = item.link || '';
        if (!u || seen.has(u)) continue;
        seen.add(u);
        out.push({
          title: item.title || '',
          url: u,
          summary: (item.contentSnippet || item.content || '').slice(0, 400),
          imageUrl: null,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          sourceName: `Product Hunt · ${topic}`,
        });
      }
    } catch {}
  }
  return out;
}

async function scrapeViaApi(token: string): Promise<ScrapedArticle[]> {
  // Product Hunt v2 GraphQL — requires developer token (free)
  const query = `
    query TopAIPosts {
      posts(order: VOTES, first: 20, topic: "artificial-intelligence") {
        edges {
          node {
            id name tagline url votesCount commentsCount createdAt
            thumbnail { url }
            topics(first: 3) { edges { node { name } } }
          }
        }
      }
    }
  `;
  try {
    const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const edges = json?.data?.posts?.edges || [];
    return edges.map(({ node }: any) => ({
      title: `${node.name} — ${node.tagline}`,
      url: node.url,
      summary: `🚀 ${node.votesCount} votes · ${node.commentsCount} comments\nTopics: ${(node.topics?.edges || []).map((e: any) => e.node?.name).join(', ')}`,
      imageUrl: node.thumbnail?.url || null,
      publishedAt: node.createdAt || new Date().toISOString(),
      sourceName: 'Product Hunt',
    } as ScrapedArticle));
  } catch { return []; }
}

export async function scrapeProductHunt(): Promise<ScrapedArticle[]> {
  const token = await getSetting('PRODUCTHUNT_TOKEN');
  if (token) {
    const api = await scrapeViaApi(token);
    if (api.length) return api.slice(0, 30);
  }
  return (await scrapeViaRss()).slice(0, 30);
}
