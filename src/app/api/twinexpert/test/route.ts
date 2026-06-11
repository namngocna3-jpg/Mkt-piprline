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
    const twinId = body.twinId || (await getSetting('TWINEXPERT_TWIN_ID'));

    if (!apiKey) return Response.json({ ok: false, steps: [{ step: 'config', ok: false, detail: 'Chưa có TWINEXPERT_API_KEY' }] });

    // ===== STEP 1: validate key =====
    {
      const r = await tryFetch(`${BASE_URL}/auth/validate`, { headers: authHeaders(apiKey) });
      steps.push({
        step: '1. GET /auth/validate',
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        detail: r.status < 300 ? '✓ API key hợp lệ. Twin gắn tự động với key (không cần Twin ID).' : 'Key không hợp lệ',
        raw: r.text.slice(0, 200),
      });
    }

    // ===== STEP 2: create/get conversation by-namespace (API thật) =====
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
        step: '2. POST /conversations/by-namespace',
        ok,
        status: r.status,
        detail: ok ? `✓ Tạo/lấy conversation OK, id=${id}` : `Status ${r.status}${id ? '' : ', không tìm thấy id'}`,
        raw: r.text.slice(0, 300),
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
