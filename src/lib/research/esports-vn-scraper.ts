import Parser from 'rss-parser';
import { parse as parseHtml } from 'node-html-parser';
import type { ScrapedArticle } from './rss-scraper';
import { webSearchAny } from '../webSearchProviders';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mkt-piprline/1.0' } });

// VNG eSports, Riot Vietnam, Garena
const ESPORTS_SOURCES = [
  { url: 'https://esports.vn/feed', name: 'VNG eSports' },
  { url: 'https://lienminh.garena.vn/', name: 'Garena LMHT', isWeb: true },
  { url: 'https://valorant.com.vn/', name: 'Valorant VN', isWeb: true },
];

async function scrapeWebPage(url: string, name: string): Promise<ScrapedArticle[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const root = parseHtml(html);

    // Generic selector cho các site tin tức VN
    const articles = root.querySelectorAll('article, .news-item, .post-item, .article-item').slice(0, 10);

    return articles.map(el => {
      const link = el.querySelector('a');
      const title = el.querySelector('h2, h3, .title, .post-title')?.text?.trim() || '';
      const img = el.querySelector('img')?.getAttribute('src') || null;
      const desc = el.querySelector('p, .excerpt, .description')?.text?.trim() || '';

      return {
        title: `[${name}] ${title}`,
        url: link?.getAttribute('href')?.startsWith('http')
          ? link.getAttribute('href')!
          : new URL(link?.getAttribute('href') || '', url).href,
        summary: desc.slice(0, 500),
        imageUrl: img?.startsWith('http') ? img : new URL(img || '', url).href,
        publishedAt: new Date().toISOString(),
        sourceName: name,
      };
    }).filter(a => a.url && a.title);
  } catch {
    return [];
  }
}

// Web search cho keywords eSports VN specific
async function searchEsportsVN(): Promise<ScrapedArticle[]> {
  const queries = [
    'VCS 2025 lịch thi đấu',
    'Valorant Champions Tour Vietnam',
    'Liên Quân Mobile giải đấu VN',
    'LMHT VCS roster thay đổi',
  ];

  const results = await Promise.allSettled(
    queries.map(q => webSearchAny(q, { mode: 'web', count: 3, freshness: 'week' }))
  );

  const out: ScrapedArticle[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      out.push({
        title: `🏆 ${item.title}`,
        url: item.url,
        summary: item.description || '',
        imageUrl: item.imageUrl || null,
        publishedAt: item.publishedAt || new Date().toISOString(),
        sourceName: 'eSports VN',
      });
    }
  }
  return out.slice(0, 15);
}

export async function scrapeEsportsVN(): Promise<ScrapedArticle[]> {
  const [search, ...pages] = await Promise.all([
    searchEsportsVN(),
    ...ESPORTS_SOURCES.map(s =>
      s.isWeb
        ? scrapeWebPage(s.url, s.name)
        : parser.parseURL(s.url).then(feed =>
            feed.items.slice(0, 10).map(item => ({
              title: item.title || '',
              url: item.link || '',
              summary: String(item.contentSnippet || '').slice(0, 500),
              imageUrl: null,
              publishedAt: item.isoDate || item.pubDate || '',
              sourceName: s.name,
            }))
          ).catch(() => [])
    ),
  ]);

  return [...search, ...pages.flat()].slice(0, 30);
}
