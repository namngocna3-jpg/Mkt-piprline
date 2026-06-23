// Lọc kết quả LẠC MỤC ĐÍCH cho tool viết content:
// loại link tải/cài đặt, trang store, từ điển/bách khoa (Wikipedia/Fandom), trang đăng nhập...
// Áp cho mọi nguồn (đặc biệt nguồn lấy qua web-search hay trả về link rác).

const BLOCK_DOMAINS = [
  'wikipedia.org', 'wikimedia.org', 'wiktionary.org', 'fandom.com', 'wikia.com',
  'play.google.com', 'apps.apple.com', 'microsoft.com/store', 'store.steampowered.com',
  'apkpure', 'apkmirror', 'apkmody', 'apkcombo', 'mod-apk', 'happymod',
  'taimienphi', 'download.com.vn', 'softpedia', 'filehippo', 'uptodown',
  'accounts.google', '/login', '/signin', '/register',
];

const BLOCK_TITLE = [
  /\bwikipedia\b/i,
  /\bdownload\b/i,
  /\bapk\b/i,
  /\bmod\s*apk\b/i,
  /\bt[aả]i\b.*\b(pc|apk|mod|v[eề]|mi[eễ]n\s*ph[ií]|cho)\b/i,  // "tải ... PC/APK/về/miễn phí/cho..."
  /\bt[aả]i\s*v[eề]\b/i,
  /\bgi[aá]\b.*\bbao\s*nhi[eê]u\b/i,                            // "giá bao nhiêu"
];

export function isOffPurpose(title?: string | null, url?: string | null): boolean {
  const u = (url || '').toLowerCase();
  if (u && BLOCK_DOMAINS.some(d => u.includes(d))) return true;
  const t = title || '';
  if (t && BLOCK_TITLE.some(re => re.test(t))) return true;
  return false;
}
