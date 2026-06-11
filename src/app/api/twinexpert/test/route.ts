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

    // ===== STEP 1: list twins =====
    let twinsList: any[] = [];
    try {
      const r = await tryFetch(`${BASE_URL}/twins`, { headers: authHeaders(apiKey) });
      const list = r.json?.data || r.json?.twins || r.json || [];
      twinsList = Array.isArray(list) ? list : [];
      const ids = twinsList.map((t: any) => t.id || t._id || t.twin_id || t.twinId).filter(Boolean);
      steps.push({
        step: '1. GET /twins',
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        detail: r.status < 300 ? `Tìm thấy ${twinsList.length} twin. IDs: ${ids.join(', ') || '(không có)'}` : 'Không lấy được danh sách twin',
        raw: r.text.slice(0, 300),
      });

      // Kiểm tra twinId có trong danh sách không
      if (twinId) {
        const found = ids.includes(twinId);
        steps.push({
          step: '1b. Kiểm tra Twin ID',
          ok: found,
          detail: found
            ? `✓ Twin ID "${twinId}" hợp lệ (có trong tài khoản).`
            : `✗ Twin ID "${twinId}" KHÔNG có trong tài khoản. ID hợp lệ: ${ids.join(', ') || '(tài khoản chưa có twin nào — tạo ở twinexpert.com)'}`,
        });
      } else {
        steps.push({ step: '1b. Kiểm tra Twin ID', ok: false, detail: '✗ Chưa cấu hình Twin ID. Chọn 1 ID từ danh sách trên.' });
      }
    } catch (e: any) {
      steps.push({ step: '1. GET /twins', ok: false, detail: `Lỗi: ${e?.message || e}` });
    }

    // Dùng twinId đã cấu hình, hoặc twin đầu tiên tìm được
    const effectiveTwinId = twinId || twinsList[0]?.id || twinsList[0]?._id || twinsList[0]?.twin_id || twinsList[0]?.twinId || '';
    if (!effectiveTwinId) {
      return Response.json({ ok: false, steps, summary: 'Không có Twin ID khả dụng. Tạo twin ở twinexpert.com hoặc kiểm tra key.' });
    }

    // ===== STEP 2: create conversation (thử nhiều shape) =====
    const convPayloads = [
      { twin_id: effectiveTwinId, title: 'Test' },
      { twinId: effectiveTwinId, title: 'Test' },
      { twin: effectiveTwinId, title: 'Test' },
    ];
    let conversationId = '';
    for (let i = 0; i < convPayloads.length; i++) {
      const r = await tryFetch(`${BASE_URL}/conversations`, { method: 'POST', headers: authHeaders(apiKey), body: JSON.stringify(convPayloads[i]) });
      const id = r.json?.data?.id || r.json?.data?._id || r.json?.data?.conversation_id || r.json?.id || r.json?._id || r.json?.conversation?.id || '';
      const ok = r.status >= 200 && r.status < 300 && !!id;
      steps.push({
        step: `2.${i + 1} POST /conversations ${JSON.stringify(convPayloads[i])}`,
        ok,
        status: r.status,
        detail: ok ? `✓ Tạo conversation OK, id=${id}` : `Status ${r.status}${id ? '' : ', không tìm thấy id trong response'}`,
        raw: r.text.slice(0, 300),
      });
      if (ok) { conversationId = id; break; }
    }

    if (!conversationId) {
      return Response.json({ ok: false, steps, summary: 'Tạo conversation thất bại — xem response raw ở bước 2 để biết API cần shape gì.' });
    }

    // ===== STEP 3: send message (thử nhiều shape) =====
    const msgPayloads = [
      { content: 'Xin chào, đây là tin nhắn test.' },
      { message: 'Xin chào, đây là tin nhắn test.' },
      { text: 'Xin chào, đây là tin nhắn test.' },
    ];
    let gotReply = false;
    for (let i = 0; i < msgPayloads.length; i++) {
      const r = await tryFetch(`${BASE_URL}/conversations/${conversationId}/messages`, { method: 'POST', headers: authHeaders(apiKey), body: JSON.stringify(msgPayloads[i]) });
      const reply = r.json?.data?.assistant_message?.content || r.json?.data?.message?.content || r.json?.data?.content || r.json?.message?.content || r.json?.content || r.json?.text || '';
      const ok = r.status >= 200 && r.status < 300 && !!reply;
      steps.push({
        step: `3.${i + 1} POST /messages ${Object.keys(msgPayloads[i])[0]}`,
        ok,
        status: r.status,
        detail: ok ? `✓ Twin trả lời: "${String(reply).slice(0, 120)}..."` : `Status ${r.status}${reply ? '' : ', không thấy nội dung trả lời'}`,
        raw: r.text.slice(0, 400),
      });
      if (ok) { gotReply = true; break; }
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
