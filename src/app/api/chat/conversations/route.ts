import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function GET(req: Request) {
  try {
    await initDb();
    const url = new URL(req.url);
    const keyId = url.searchParams.get('keyId');
    const q = url.searchParams.get('q');
    let rows;
    if (q) {
      const like = `%${q}%`;
      rows = await sql`SELECT c.id, c.key_id, c.title, c.system_prompt, c.remote_id, c.namespace, c.created_at, c.updated_at
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE ${keyId ? sql`c.key_id = ${keyId} AND` : sql``} (c.title ILIKE ${like} OR m.content ILIKE ${like})
        GROUP BY c.id
        ORDER BY c.updated_at DESC LIMIT 100`;
    } else if (keyId) {
      rows = await sql`SELECT id, key_id, title, system_prompt, remote_id, namespace, created_at, updated_at FROM conversations WHERE key_id = ${keyId} ORDER BY updated_at DESC LIMIT 100`;
    } else {
      rows = await sql`SELECT id, key_id, title, system_prompt, remote_id, namespace, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100`;
    }
    return NextResponse.json({ conversations: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const body = await req.json();
    const id = 'c_' + nanoid(8);
    const namespace = `twinchat_${nanoid(10)}`;
    await sql`INSERT INTO conversations (id, key_id, title, system_prompt, namespace) VALUES (${id}, ${body.keyId}, ${body.title || 'Chat mới'}, ${body.systemPrompt || null}, ${namespace})`;
    return NextResponse.json({ id, namespace });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    await sql`UPDATE conversations SET title = COALESCE(${body.title}, title), system_prompt = COALESCE(${body.systemPrompt}, system_prompt), remote_id = COALESCE(${body.remoteId}, remote_id), updated_at = NOW() WHERE id = ${body.id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await sql`DELETE FROM conversations WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
