import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function GET() {
  try {
    await initDb();
    const rows = await sql`SELECT id, name, key, twin_name, description, is_active FROM api_keys ORDER BY is_active DESC, created_at DESC`;
    return NextResponse.json({ keys: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const body = await req.json();
    const id = 'k_' + nanoid(8);
    await sql`INSERT INTO api_keys (id, name, key, twin_name, description, is_active) VALUES (${id}, ${body.name || 'My key'}, ${body.key || ''}, ${body.twinName || null}, ${body.description || null}, ${body.isActive ? 1 : 0})`;
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (body.setActive) {
      await sql`UPDATE api_keys SET is_active = 0`;
      await sql`UPDATE api_keys SET is_active = 1 WHERE id = ${body.id}`;
      return NextResponse.json({ success: true });
    }
    await sql`UPDATE api_keys SET name = COALESCE(${body.name}, name), key = COALESCE(${body.key}, key), twin_name = COALESCE(${body.twinName}, twin_name), description = COALESCE(${body.description}, description) WHERE id = ${body.id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await sql`DELETE FROM api_keys WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
