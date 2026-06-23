// MyMemory Translation API — FREE, KHÔNG cần API key (~5.000 từ/ngày/IP).
// Dùng dịch nhanh EN↔VI hoặc làm fallback khi không muốn tốn token LLM cho việc dịch.
export type Lang = 'en' | 'vi' | string;

export async function translateText(text: string, from: Lang = 'en', to: Lang = 'vi'): Promise<string | null> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  // MyMemory giới hạn ~500 byte/lần qua query string → cắt cho an toàn.
  const chunk = trimmed.slice(0, 480);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mkt-piprline/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const translated = json?.responseData?.translatedText;
    if (typeof translated === 'string' && translated.trim()) return translated;
    return null;
  } catch {
    return null;
  }
}

// Dịch đoạn dài bằng cách tách câu rồi ghép lại (mỗi mẩu ≤ giới hạn).
export async function translateLong(text: string, from: Lang = 'en', to: Lang = 'vi'): Promise<string | null> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 480) return translateText(trimmed, from, to);

  const sentences = trimmed.match(/[^.!?\n]+[.!?\n]*/g) || [trimmed];
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > 460) { if (buf) chunks.push(buf); buf = s; }
    else buf += s;
  }
  if (buf) chunks.push(buf);

  const parts: string[] = [];
  for (const c of chunks) {
    const t = await translateText(c, from, to);
    if (t === null) return null; // lỗi giữa chừng → trả null để caller tự xử lý
    parts.push(t);
  }
  return parts.join(' ');
}
