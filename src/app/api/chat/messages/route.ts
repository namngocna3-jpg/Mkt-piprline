import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function GET(req: Request) {
  try {
    await initDb();
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    const rows = await sql`SELECT id, conversation_id, role, content, attachments, position, created_at FROM messages WHERE conversation_id = ${conversationId} ORDER BY position ASC`;
    return NextResponse.json({ messages: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body.id || ('m_' + nanoid(10));
    const attachments = body.attachments ? JSON.stringify(body.attachments) : null;
    await sql`INSERT INTO messages (id, conversation_id, role, content, attachments, position) VALUES (${id}, ${body.conversationId}, ${body.role}, ${body.content}, ${attachments}, ${body.position}) ON CONFLICT (id) DO UPDATE SET content = ${body.content}, attachments = ${attachments}`;
    await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${body.conversationId}`;
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (body.truncateAfter !== undefined) {
      await sql`DELETE FROM messages WHERE conversation_id = ${body.conversationId} AND position >= ${body.truncateAfter}`;
      return NextResponse.json({ success: true });
    }
    await sql`UPDATE messages SET content = ${body.content} WHERE id = ${body.id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await sql`DELETE FROM messages WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
