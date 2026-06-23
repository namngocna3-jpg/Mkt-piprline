import { getSetting } from '../settings';

// Google KHAI TỬ model cũ (vd gemini-2.0-flash) → hardcode default sẽ 404.
// Module này HỎI KEY xem model nào còn sống & hỗ trợ generateContent, rồi tự chọn bản tốt.

const DEAD = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']);

let cacheIds: string[] = [];
let cacheBest = '';
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

// Danh sách model Gemini hỗ trợ generateContent (dùng viết bài/chat) từ key.
export async function listGeminiTextModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1000`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter((id: string) => /gemini/i.test(id) && !/embedding|aqa/i.test(id));
  } catch {
    return [];
  }
}

// Điểm ưu tiên: phiên bản mới hơn > thấp; ưu tiên flash (nhanh/rẻ) rồi pro; tránh bản thử nghiệm/đặc thù.
function rank(id: string): number {
  const v = parseFloat((id.match(/gemini-(\d+\.?\d*)/) || [])[1] || '0');
  let s = v * 10;
  if (/flash/.test(id)) s += 3;
  if (/pro/.test(id)) s += 2;
  if (/lite/.test(id)) s += 1;
  if (/-latest$/.test(id)) s += 0.6;
  if (/exp|preview|thinking|tts|image|audio|vision|learnlm|live|\d{3}$/.test(id)) s -= 6;
  return s;
}

// Chọn model Gemini để dùng. Tôn trọng lựa chọn user (trừ model đã chết), else tự chọn từ key.
export async function pickGeminiModel(preferred?: string): Promise<string> {
  const p = (preferred || '').trim();
  if (p && !DEAD.has(p)) return p; // user chọn model cụ thể còn dùng được → tôn trọng

  const key = await getSetting('GEMINI_API_KEY');
  if (!key) return p && !DEAD.has(p) ? p : 'gemini-2.5-flash';

  if (cacheBest && Date.now() - cacheAt < TTL) return cacheBest;
  const ids = (await listGeminiTextModels(key)).filter(id => !DEAD.has(id));
  if (!ids.length) return 'gemini-2.5-flash';
  cacheBest = ids.slice().sort((a, b) => rank(b) - rank(a))[0];
  cacheIds = ids;
  cacheAt = Date.now();
  return cacheBest;
}
