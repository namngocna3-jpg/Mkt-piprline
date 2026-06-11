import { sql } from '@/lib/db';
import { getOrCreateConversation, sendMessageStream } from '@/lib/twinClient';

export const maxDuration = 120;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { keyId, conversationId, content, twinId: twinIdOverride } = body;

    const [keyRow] = await sql`SELECT key, twin_name FROM api_keys WHERE id = ${keyId}`;
    if (!keyRow) return new Response(JSON.stringify({ error: 'API key not found' }), { status: 400 });
    const apiKey = keyRow.key as string;
    // Twin ID OPTIONAL — by-namespace tự lấy twin từ key.
    const twinId = twinIdOverride || keyRow.twin_name || '';

    const [conv] = await sql`SELECT remote_id, namespace FROM conversations WHERE id = ${conversationId}`;
    if (!conv) return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 400 });

    let remoteId = conv.remote_id as string | null;
    if (!remoteId) {
      remoteId = await getOrCreateConversation(apiKey, twinId, conv.namespace as string);
      await sql`UPDATE conversations SET remote_id = ${remoteId} WHERE id = ${conversationId}`;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`));
        };
        try {
          await sendMessageStream(apiKey, remoteId!, content, {
            onDelta: (chunk) => write('delta', { content: chunk }),
            onComplete: (full) => { write('message_complete', { content: full }); controller.close(); },
            onError: (err) => { write('error', { message: err }); controller.close(); },
          });
        } catch (e: any) {
          write('error', { message: e?.message || String(e) });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}
