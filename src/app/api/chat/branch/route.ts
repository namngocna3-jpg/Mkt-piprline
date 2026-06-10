import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  try {
    const { conversationId, throughPosition } = await req.json();
    const [src] = await sql`SELECT key_id, title, system_prompt FROM conversations WHERE id = ${conversationId}`;
    if (!src) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const newId = 'c_' + nanoid(8);
    const namespace = `twinchat_${nanoid(10)}`;
    await sql`INSERT INTO conversations (id, key_id, title, system_prompt, namespace) VALUES (${newId}, ${src.key_id}, ${(src.title || 'Chat') + ' · nhánh'}, ${src.system_prompt}, ${namespace})`;

    const msgs = await sql`SELECT id, role, content, attachments, position FROM messages WHERE conversation_id = ${conversationId} AND position <= ${throughPosition} ORDER BY position ASC`;
    for (const m of msgs as any[]) {
      const mid = 'm_' + nanoid(10);
      await sql`INSERT INTO messages (id, conversation_id, role, content, attachments, position) VALUES (${mid}, ${newId}, ${m.role}, ${m.content}, ${m.attachments}, ${m.position})`;
    }
    return NextResponse.json({ id: newId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
