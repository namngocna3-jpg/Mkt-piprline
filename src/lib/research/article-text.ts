import { parse as parseHtml } from 'node-html-parser';

// Cào NỘI DUNG ĐẦY ĐỦ của 1 bài viết từ URL (không chỉ snippet RSS/search).
// Dùng khi viết bài: lấy text thật của bài update/patch game để AI có dữ liệu thực.
// Trích phần chính (article/main hoặc cụm có nhiều <p> nhất), bỏ nav/menu/script.

const STRIP_TAGS = ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'svg', 'iframe'];

export async function fetchArticleText(url: string, maxChars = 5000): Promise<string> {
  if (!url || !/^https?:\/\//.test(url)) return '';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return '';
    const html = await res.text();
    const root = parseHtml(html);

    // Bỏ các thẻ nhiễu
    for (const tag of STRIP_TAGS) root.querySelectorAll(tag).forEach(n => n.remove());

    // Ứng viên vùng nội dung chính
    const containers = [
      ...root.querySelectorAll('article'),
      ...root.querySelectorAll('main'),
      ...root.querySelectorAll('[role="main"]'),
      ...root.querySelectorAll('.article-body, .post-content, .entry-content, .content__article-body'),
    ];

    const extractFrom = (el: any): string => {
      const blocks = el.querySelectorAll('p, h1, h2, h3, h4, li');
      const parts: string[] = [];
      for (const b of blocks) {
        const t = b.text.replace(/\s+/g, ' ').trim();
        if (t.length >= 30 || /^h[1-4]$/i.test(b.tagName || '')) parts.push(t);
      }
      return parts.join('\n').trim();
    };

    // Chọn container cho ra nhiều text nhất; nếu không có, quét toàn trang.
    let best = '';
    for (const c of containers) {
      const txt = extractFrom(c);
      if (txt.length > best.length) best = txt;
    }
    if (best.length < 200) {
      const whole = extractFrom(root);
      if (whole.length > best.length) best = whole;
    }

    best = best.replace(/\n{3,}/g, '\n\n').trim();

    // Trang SPA (JS render) hoặc chặn bot → fetch tĩnh ra rất ít chữ.
    // Fallback Jina Reader (free, không key): render JS + vượt chặn, trả text sạch.
    if (best.length < 400) {
      const viaReader = await fetchViaJinaReader(url, maxChars);
      if (viaReader.length > best.length) best = viaReader;
    }

    return best.slice(0, maxChars).trim();
  } catch {
    // Lỗi mạng/403 ở fetch trực tiếp → vẫn thử Jina Reader.
    return fetchViaJinaReader(url, maxChars);
  }
}

// Jina AI Reader — FREE, KHÔNG cần key. Render JS, vượt chặn bot, trả markdown/plain text.
async function fetchViaJinaReader(url: string, maxChars: number): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'User-Agent': 'Mkt-piprline/1.0', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return '';
    const text = await res.text();
    // Bỏ phần header meta Jina chèn (Title/URL Source/...) nếu có, giữ phần nội dung.
    const cleaned = text
      .replace(/^Title:.*$/im, '')
      .replace(/^URL Source:.*$/im, '')
      .replace(/^Published Time:.*$/im, '')
      .replace(/^Markdown Content:\s*/im, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned.slice(0, maxChars);
  } catch {
    return '';
  }
}
