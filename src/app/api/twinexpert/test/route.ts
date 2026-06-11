import { getSetting } from '@/lib/settings';

export const maxDuration = 60;
export const runtime = 'nodejs';

const BASE_URL = 'https://api.twinexpert.com/api/v1';

function authHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

type Step = { step: string; ok: boolean; status?: number; detail: string; raw?: string };

async function tryFetch(url: string, init: RequestInit): Promise<{ status: number; text: string; json: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
}

export async function POST(req: Request) {
  const steps: Step[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = body.apiKey || (await getSetting('TWINEXPERT_API_KEY'));
    if (!apiKey) return Response.json({ ok: false, steps: [{ step: 'config', ok: false, detail: 'Chưa có TWINEXPERT_API_KEY' }] });

    // Cảnh báo format key
    if (!/^ak_/.test(apiKey)) {
      steps.push({
        step: '0. Định dạng key',
        ok: false,
        detail: `⚠️ Key "${apiKey.slice(0, 6)}..." KHÔNG bắt đầu bằng "ak_". API key TwinExpert phải dạng ak_... — tạo ở twinexpert.com/profile/api-keys (đừng dùng password/username).`,
      });
    }

    // ===== STEP 1: GET /twins =====
    let twinId = body.twinId || (await getSetting('TWINEXPERT_TWIN_ID')) || '';
    {
      const r = await tryFetch(`${BASE_URL}/twins`, { headers: authHeaders(apiKey) });
      const list = r.json?.data || r.json?.twins || (Array.isArray(r.json) ? r.json : []) || [];
      const ids = (Array.isArray(list) ? list : []).map((t: any) => t.id || t._id || t.twin_id || t.twinId).filter(Boolean);
      const invalidFmt = /invalid api key format/i.test(r.text);
      steps.push({
        step: '1. GET /twins',
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        detail: invalidFmt
          ? '✗ "Invalid API key format" — key SAI ĐỊNH DẠNG. Phải là ak_... tạo ở twinexpert.com/profile/api-keys.'
          : r.status < 300 ? `Tìm thấy ${ids.length} twin: ${ids.join(', ') || '(rỗng)'}` : `Lỗi ${r.status}`,
        raw: r.text.slice(0, 250),
      });
      if (!twinId && ids.length) twinId = ids[0];
    }

    // ===== STEP 2: create conversation (thử by-namespace rồi /conversations) =====
    const namespace = `test_${Date.now()}`;
    let conversationId = '';
    {
      const r = await tryFetch(`${BASE_URL}/conversations/by-namespace`, {
        method: 'POST', headers: authHeaders(apiKey),
        body: JSON.stringify({ namespace, title: 'Test' }),
      });
      const id = r.json?.data?.id || r.json?.data?._id || r.json?.id || r.json?._id || '';
      const ok = r.status >= 200 && r.status < 300 && !!id;
      steps.push({
        step: '2a. POST /conversations/by-namespace',
        ok, status: r.status,
        detail: ok ? `✓ OK, id=${id}` : `Status ${r.status}${id ? '' : ', không thấy id'}`,
        raw: r.text.slice(0, 250),
      });
      if (ok) conversationId = id;
    }
    if (!conversationId && twinId) {
      const r = await tryFetch(`${BASE_URL}/conversations`, {
        method: 'POST', headers: authHeaders(apiKey),
        body: JSON.stringify({ twinId, title: 'Test' }),
      });
      const id = r.json?.data?.id || r.json?.data?._id || r.json?.id || r.json?._id || '';
      const ok = r.status >= 200 && r.status < 300 && !!id;
      steps.push({
        step: '2b. POST /conversations { twinId }',
        ok, status: r.status,
        detail: ok ? `✓ OK, id=${id}` : `Status ${r.status}${id ? '' : ', không thấy id'}`,
        raw: r.text.slice(0, 250),
      });
      if (ok) conversationId = id;
    }

    if (!conversationId) {
      return Response.json({ ok: false, steps, summary: 'Tạo conversation thất bại — xem raw bước 2.' });
    }

    // ===== STEP 3: send message (non-stream) =====
    let gotReply = false;
    {
      const r = await tryFetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
        method: 'POST', headers: authHeaders(apiKey),
        body: JSON.stringify({ content: 'Xin chào, đây là tin nhắn test. Trả lời ngắn gọn.' }),
      });
      const reply = r.json?.data?.assistantMessage?.content || r.json?.data?.assistant_message?.content || r.json?.data?.message?.content || r.json?.data?.content || r.json?.content || '';
      const ok = r.status >= 200 && r.status < 300 && !!reply;
      steps.push({
        step: '3. POST /messages { content }',
        ok,
        status: r.status,
        detail: ok ? `✓ Twin trả lời: "${String(reply).slice(0, 150)}..."` : `Status ${r.status}${reply ? '' : ', không thấy nội dung trả lời'}`,
        raw: r.text.slice(0, 400),
      });
      if (ok) gotReply = true;
    }

    return Response.json({
      ok: gotReply,
      steps,
      summary: gotReply
        ? '✅ TwinExpert hoạt động! Twin đã trả lời được.'
        : '⚠️ Tạo được conversation nhưng KHÔNG gửi/nhận được message. Xem raw bước 3 để biết shape API.',
    });
  } catch (e: any) {
    steps.push({ step: 'exception', ok: false, detail: e?.message || String(e) });
    return Response.json({ ok: false, steps, summary: 'Lỗi không mong đợi.' }, { status: 500 });
  }
}
