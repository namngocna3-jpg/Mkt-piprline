// Làm sạch text: bỏ thẻ HTML + decode HTML entities cơ bản.
// Dùng cho summary cào từ web (Quora/Brave/RSS thường dính <strong>, &#x27;...).

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&#x27;': "'", '&#x2F;': '/', '&#47;': '/',
  '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};

// Bỏ markdown để post hợp Facebook (FB KHÔNG render **, ##, *...).
// Nhấn mạnh giữ nguyên chữ (vd **abc** -> abc). Bullet -> "• ".
export function stripMarkdown(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .split('\n')
    .map((line) => {
      let l = line;
      // Heading: ## Title -> Title
      l = l.replace(/^\s{0,3}#{1,6}\s+/, '');
      // Blockquote: > text -> text
      l = l.replace(/^\s{0,3}>\s?/, '');
      // Bullet: - item / * item -> • item
      l = l.replace(/^(\s*)[-*+]\s+/, '$1• ');
      return l;
    })
    .join('\n')
    // Bold/italic: **x** __x__ *x* _x_ -> x
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1$2')
    // Inline code `x` -> x
    .replace(/`([^`]+)`/g, '$1')
    // Link [text](url) -> text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Còn sót ** hoặc * lẻ -> bỏ
    .replace(/\*\*/g, '')
    .replace(/\s+\n/g, '\n')
    .trim();
}

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
