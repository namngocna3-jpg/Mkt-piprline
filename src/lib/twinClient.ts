const BASE_URL = 'https://api.twinexpert.com/api/v1';

type Headers = Record<string, string>;

function authHeaders(apiKey: string): Headers {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

export async function validateKey(apiKey: string): Promise<{ valid: boolean; info?: any; error?: string }> {
  try {
    // Try /auth/validate first, then fallback to /twins (any 2xx means key works)
    const endpoints = ['/auth/validate', '/auth/me', '/twins'];
    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep}`, { headers: authHeaders(apiKey) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { valid: true, info: data };
      }
      if (res.status === 401) return { valid: false, error: 'API key không hợp lệ hoặc đã hết hạn (401)' };
    }
    return { valid: false, error: 'Không validate được key (tất cả endpoint đều fail).' };
  } catch (e: any) {
    return { valid: false, error: e?.message || String(e) };
  }
}

export async function getUsage(apiKey: string) {
  const res = await fetch(`${BASE_URL}/auth/usage`, { headers: authHeaders(apiKey) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Usage lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.data || json;
}

export async function listTwins(apiKey: string) {
  const res = await fetch(`${BASE_URL}/twins`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error(`List twins failed (${res.status})`);
  const json = await res.json();
  const list = json?.data || json?.twins || [];
  return Array.isArray(list) ? list : [];
}

function pickConversationId(json: any): string | undefined {
  return (
    json?.data?.id ||
    json?.data?._id ||
    json?.data?.conversation_id ||
    json?.data?.conversation?.id ||
    json?.data?.conversation?._id ||
    json?.conversation?.id ||
    json?.conversation?._id ||
    json?.conversation_id ||
    json?.id ||
    json?._id ||
    json?.result?.id ||
    json?.result?._id
  );
}

async function firstTwinId(apiKey: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/twins`, { headers: authHeaders(apiKey) });
    if (!res.ok) return '';
    const json = await res.json().catch(() => null);
    const list = json?.data || json?.twins || json || [];
    const arr = Array.isArray(list) ? list : [];
    const t = arr[0];
    return t?.id || t?._id || t?.twin_id || t?.twinId || '';
  } catch { return ''; }
}

export async function getOrCreateConversation(apiKey: string, twinId: string, namespace: string) {
  const errors: string[] = [];

  // Cách 1: by-namespace (twin auto theo key) — docs A
  try {
    const res = await fetch(`${BASE_URL}/conversations/by-namespace`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ namespace, title: namespace || 'Chat Session' }),
    });
    const text = await res.text();
    if (res.ok) {
      const json = JSON.parse(text);
      const id = pickConversationId(json);
      if (id) return id;
      errors.push(`by-namespace: no id (${text.slice(0, 120)})`);
    } else {
      errors.push(`by-namespace ${res.status}: ${text.slice(0, 120)}`);
    }
  } catch (e: any) { errors.push(`by-namespace err: ${e?.message || e}`); }

  // Cách 2: /conversations { twinId, title } — docs B (cần twinId)
  let tid = twinId && !/\s/.test(twinId) ? twinId : '';
  if (!tid) tid = await firstTwinId(apiKey);
  if (tid) {
    for (const body of [{ twinId: tid, title: namespace }, { twin_id: tid, title: namespace }]) {
      try {
        const res = await fetch(`${BASE_URL}/conversations`, {
          method: 'POST', headers: authHeaders(apiKey), body: JSON.stringify(body),
        });
        const text = await res.text();
        if (res.ok) {
          const json = JSON.parse(text);
          const id = pickConversationId(json);
          if (id) return id;
          errors.push(`/conversations: no id`);
        } else {
          errors.push(`/conversations ${res.status}: ${text.slice(0, 120)}`);
        }
      } catch (e: any) { errors.push(`/conversations err: ${e?.message || e}`); }
    }
  } else {
    errors.push('không lấy được twinId (GET /twins rỗng hoặc lỗi)');
  }

  throw new Error(`Tạo conversation thất bại. ${errors.join(' | ')}`);
}

export type StreamCallbacks = {
  onDelta: (chunk: string) => void;
  onComplete?: (finalText: string) => void;
  onError?: (err: string) => void;
};

export async function sendMessageStream(
  apiKey: string,
  conversationId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  // Thử endpoint /messages/stream (docs B), fallback /messages {stream:true} (docs A).
  let res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: { ...authHeaders(apiKey), 'Accept': 'text/event-stream' },
    body: JSON.stringify({ content, stream: true }),
    signal,
  }).catch(() => null as any);

  if (!res || !res.ok || !res.body) {
    res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { ...authHeaders(apiKey), 'Accept': 'text/event-stream' },
      body: JSON.stringify({ content, stream: true }),
      signal,
    }).catch(() => null as any);
  }

  if (!res || !res.ok || !res.body) {
    // Fallback cuối: non-streaming
    return sendMessageOnce(apiKey, conversationId, content, callbacks, signal);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = rawEvent.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        const dataStr = dataLines.join('\n');
        if (!dataStr || dataStr === '[DONE]') continue;
        let payload: any = dataStr;
        try { payload = JSON.parse(dataStr); } catch {}

        if (eventName === 'delta' || eventName === 'message_delta' || eventName === 'message' || eventName === 'content_block_delta' || eventName === 'token') {
          const chunk =
            (typeof payload === 'string' ? payload : null) ||
            payload?.delta?.text ||
            payload?.delta?.content ||
            payload?.delta ||
            payload?.content ||
            payload?.text ||
            payload?.token ||
            payload?.message?.content ||
            payload?.choices?.[0]?.delta?.content ||
            payload?.data?.content ||
            payload?.data?.delta ||
            '';
          const chunkStr = typeof chunk === 'string' ? chunk : (chunk ? JSON.stringify(chunk) : '');
          if (chunkStr) {
            finalText += chunkStr;
            callbacks.onDelta(chunkStr);
          }
        } else if (eventName === 'message_complete' || eventName === 'done' || eventName === 'complete' || eventName === 'message_stop') {
          const full =
            payload?.content ||
            payload?.message?.content ||
            payload?.text ||
            payload?.data?.content ||
            payload?.data?.message?.content ||
            finalText;
          finalText = full || finalText;
        } else if (eventName === 'error') {
          const errMsg = payload?.message || payload?.error || (typeof payload === 'string' ? payload : JSON.stringify(payload));
          callbacks.onError?.(errMsg);
          throw new Error(errMsg);
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  callbacks.onComplete?.(finalText);
  return finalText;
}

async function sendMessageOnce(
  apiKey: string,
  conversationId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ content }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = `Send message failed (${res.status}): ${text.slice(0, 300)}`;
    callbacks.onError?.(err);
    throw new Error(err);
  }
  let json: any;
  try { json = JSON.parse(text); } catch { json = { content: text }; }
  const aiText =
    json?.data?.assistantMessage?.content ||
    json?.data?.assistant_message?.content ||
    json?.data?.assistant?.content ||
    json?.data?.reply?.content ||
    json?.data?.response?.content ||
    json?.data?.message?.content ||
    json?.data?.messages?.[json?.data?.messages?.length - 1]?.content ||
    json?.data?.content ||
    json?.data?.text ||
    json?.data?.answer ||
    json?.assistant_message?.content ||
    json?.message?.content ||
    json?.reply?.content ||
    json?.response?.content ||
    json?.content ||
    json?.text ||
    json?.answer ||
    json?.choices?.[0]?.message?.content ||
    '';
  const out = typeof aiText === 'string' ? aiText : JSON.stringify(aiText);
  if (!out) {
    const dbg = `TwinExpert response shape unrecognised. Keys: ${Object.keys(json || {}).join(',')} | first 200 chars: ${text.slice(0, 200)}`;
    callbacks.onError?.(dbg);
    throw new Error(dbg);
  }
  callbacks.onDelta(out);
  callbacks.onComplete?.(out);
  return out;
}
