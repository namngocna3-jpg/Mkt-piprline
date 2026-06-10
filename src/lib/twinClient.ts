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

export async function getOrCreateConversation(apiKey: string, twinId: string, namespace: string) {
  // Tạo conversation mới mỗi namespace duy nhất — gắn với 1 chat phía client.
  const payloads = [
    { twin_id: twinId, title: namespace, namespace },
    { twinId: twinId, title: namespace, namespace },
    { twin: twinId, title: namespace, namespace },
  ];
  let lastErr = '';
  for (const body of payloads) {
    const res = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) { lastErr = `${res.status}: ${text.slice(0, 200)}`; continue; }
    let json: any;
    try { json = JSON.parse(text); } catch { lastErr = `Non-JSON: ${text.slice(0, 200)}`; continue; }
    const id = json?.data?.id || json?.data?._id || json?.id || json?._id || json?.conversation?.id;
    if (id) return id;
    lastErr = `No id in response: ${text.slice(0, 200)}`;
  }
  throw new Error(`Create conversation failed. ${lastErr}`);
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
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: { ...authHeaders(apiKey), 'Accept': 'text/event-stream' },
    body: JSON.stringify({ content, message: content, text: content }),
    signal,
  });

  if (!res.ok || !res.body) {
    // Fallback: non-streaming endpoint
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

        if (eventName === 'delta' || eventName === 'message_delta' || eventName === 'message') {
          const chunk =
            (typeof payload === 'string' ? payload : null) ||
            payload?.delta ||
            payload?.content ||
            payload?.text ||
            payload?.message?.content ||
            '';
          if (chunk) {
            finalText += chunk;
            callbacks.onDelta(chunk);
          }
        } else if (eventName === 'message_complete' || eventName === 'done' || eventName === 'complete') {
          const full = payload?.content || payload?.message?.content || payload?.text || finalText;
          finalText = full || finalText;
        } else if (eventName === 'error') {
          const errMsg = payload?.message || payload?.error || JSON.stringify(payload);
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
    body: JSON.stringify({ content, message: content, text: content }),
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
    json?.data?.assistant_message?.content ||
    json?.data?.message?.content ||
    json?.data?.content ||
    json?.message?.content ||
    json?.content ||
    json?.text ||
    '';
  callbacks.onDelta(aiText);
  callbacks.onComplete?.(aiText);
  return aiText;
}
