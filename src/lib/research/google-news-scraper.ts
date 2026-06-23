import Parser from 'rss-parser';
import type { ScrapedArticle } from './rss-scraper';

// Google News RSS — FREE, KHÔNG cần API key. Hỗ trợ tiếng Việt (hl=vi&gl=VN).
// Tìm theo từ khóa bất kỳ → phủ rộng hơn nhiều RSS cố định.
const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mkt-piprline/1.0' } });

// Mỗi query chạy ở 1 locale. VI cho thị trường Việt, EN cho tin AI quốc tế.
const QUERIES: { q: string; locale: 'vi' | 'en'; source: string }[] = [
  { q: 'trí tuệ nhân tạo OR AI OR ChatGPT', locale: 'vi', source: 'Google News VN · AI' },
  { q: 'công cụ AI OR ứng dụng AI mới', locale: 'vi', source: 'Google News VN · AI Tools' },
  { q: 'AI marketing OR content AI', locale: 'vi', source: 'Google News VN · Marketing' },
  { q: 'artificial intelligence OR LLM OR generative AI', locale: 'en', source: 'Google News · AI' },
  { q: 'OpenAI OR Anthropic OR Claude OR Gemini', locale: 'en', source: 'Google News · AI Labs' },
  { q: 'AI startup funding OR AI launch', locale: 'en', source: 'Google News · AI Business' },
];

const MAX_AGE_HOURS = 72;

function feedUrl(q: string, locale: 'vi' | 'en'): string {
  const params = locale === 'vi' ? 'hl=vi&gl=VN&ceid=VN:vi' : 'hl=en-US&gl=US&ceid=US:en';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${params}`;
}

// Tiêu đề Google News có dạng "Tiêu đề - Tên báo" → tách lấy nguồn gốc.
function splitTitle(raw: string): { title: string; publisher: string } {
  const idx = raw.lastIndexOf(' - ');
  if (idx > 10) return { title: raw.slice(0, idx).trim(), publisher: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), publisher: '' };
}

export async function scrapeGoogleNews(customQuery?: string): Promise<ScrapedArticle[]> {
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();

  const queries = customQuery
    ? [{ q: customQuery, locale: 'vi' as const, source: `Google News · ${customQuery.slice(0, 30)}` }]
    : QUERIES;

  const results = await Promise.allSettled(
    queries.map(item => parser.parseURL(feedUrl(item.q, item.locale)).then(feed => ({ feed, item })))
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { feed, item } = r.value;
    for (const post of (feed.items || []).slice(0, 15)) {
      const url = post.link || '';
      if (!url || seen.has(url)) continue;
      const ts = post.isoDate || post.pubDate;
      if (ts && new Date(ts).getTime() < cutoff) continue;
      seen.add(url);
      const { title, publisher } = splitTitle(post.title || '');
      if (!title) continue;
      const body = String(post.contentSnippet || post.content || '').replace(/<[^>]+>/g, '').trim();
      out.push({
        title,
        url,
        summary: `${publisher ? `📰 ${publisher}\n` : ''}${body}`.slice(0, 500),
        imageUrl: null, // Google News RSS không kèm ảnh — route tự fetch og:image nếu cần
        publishedAt: ts || new Date().toISOString(),
        sourceName: item.source,
      });
    }
  }
  return out.slice(0, 50);
}
