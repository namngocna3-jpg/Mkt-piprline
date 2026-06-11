// Làm sạch text: bỏ thẻ HTML + decode HTML entities cơ bản.
// Dùng cho summary cào từ web (Quora/Brave/RSS thường dính <strong>, &#x27;...).

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&#x27;': "'", '&#x2F;': '/', '&#47;': '/',
  '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};

export function cleanText(input?: string | null): string {
  if (!input) return '';
  let t = String(input);
  // Bỏ thẻ HTML
  t = t.replace(/<[^>]+>/g, ' ');
  // Decode named/numeric entities phổ biến
  t = t.replace(/&[a-zA-Z#0-9x]+;/g, (m) => {
    if (ENTITIES[m]) return ENTITIES[m];
    const num = m.match(/^&#(\d+);$/);
    if (num) return String.fromCodePoint(parseInt(num[1], 10));
    const hex = m.match(/^&#x([0-9a-fA-F]+);$/);
    if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
    return m;
  });
  // Gom khoảng trắng
  return t.replace(/\s+/g, ' ').trim();
}
