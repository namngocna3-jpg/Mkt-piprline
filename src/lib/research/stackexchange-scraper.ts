import type { ScrapedArticle } from './rss-scraper';

// Stack Exchange API — FREE, KHÔNG cần API key (~300 request/ngày/IP).
// Lấy câu hỏi nóng theo tag → phản ánh vấn đề kỹ thuật cộng đồng đang quan tâm.
type SETarget = { site: string; tags: string[]; label: string };

const TARGETS: SETarget[] = [
  { site: 'stackoverflow', tags: ['openai-api', 'large-language-model', 'langchain'], label: 'Stack Overflow · AI' },
  { site: 'ai.stackexchange', tags: ['machine-learning', 'neural-networks'], label: 'AI StackExchange' },
];

const SINCE_HOURS = 72;

export async function scrapeStackExchange(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const fromDate = Math.floor((Date.now() - SINCE_HOURS * 3600 * 1000) / 1000);

  const tasks: Promise<void>[] = [];
  for (const t of TARGETS) {
    for (const tag of t.tags) {
      const url = `https://api.stackexchange.com/2.3/questions?order=desc&sort=votes`
        + `&tagged=${encodeURIComponent(tag)}&site=${t.site}&pagesize=10&fromdate=${fromDate}`
        + `&filter=!nKzQUR3Egv`; // filter gọn: title, link, score, tags, creation_date
      tasks.push((async () => {
        try {
          const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0' } });
          if (!res.ok) return;
          const json = await res.json();
          for (const item of (json?.items || [])) {
            const link = item.link || '';
            if (!link || seen.has(link)) continue;
            seen.add(link);
            const title = String(item.title || '').replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"');
            out.push({
              title,
              url: link,
              summary: `❓ ${item.score || 0} votes · ${item.answer_count || 0} answers · tags: ${(item.tags || []).join(', ')}`.slice(0, 500),
              imageUrl: null,
              publishedAt: item.creation_date ? new Date(item.creation_date * 1000).toISOString() : new Date().toISOString(),
              sourceName: t.label,
            });
          }
        } catch { /* bỏ qua tag lỗi */ }
      })());
    }
  }
  await Promise.allSettled(tasks);
  return out.slice(0, 30);
}
