import type { ScrapedArticle } from './rss-scraper';

// Wikipedia REST API — FREE, KHÔNG cần API key.
// Lấy "most read" (bài được đọc nhiều nhất hôm qua) → tín hiệu chủ đề đang hot,
// kèm ảnh thumbnail và đoạn extract làm context cho bài viết.
const LANGS: { lang: string; label: string }[] = [
  { lang: 'vi', label: 'Wikipedia · Đang hot (VN)' },
  { lang: 'en', label: 'Wikipedia · Trending' },
];

function yesterdayPath(): string {
  // Dùng ngày HÔM QUA cho chắc (feed hôm nay có thể chưa có dữ liệu).
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export async function scrapeWikipedia(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const datePath = yesterdayPath();

  await Promise.allSettled(LANGS.map(async ({ lang, label }) => {
    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/feed/featured/${datePath}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0 (content-research)' } });
      if (!res.ok) return;
      const json = await res.json();
      const articles = (json?.mostread?.articles || []).slice(0, 12);
      for (const a of articles) {
        const page = a?.content_urls?.desktop?.page || '';
        if (!page || seen.has(page)) continue;
        // Bỏ các trang meta (Special:, trang chủ...)
        if (/Special:|:Trang_Ch|Main_Page/i.test(page)) continue;
        seen.add(page);
        out.push({
          title: String(a.normalizedtitle || a.title || '').replace(/_/g, ' '),
          url: page,
          summary: `📈 ${(a.views || 0).toLocaleString()} lượt xem\n${a.extract || ''}`.slice(0, 500),
          imageUrl: a?.thumbnail?.source || null,
          publishedAt: new Date().toISOString(),
          sourceName: label,
        });
      }
    } catch { /* bỏ qua ngôn ngữ lỗi */ }
  }));
  return out.slice(0, 24);
}
