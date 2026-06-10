import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getAllSettings, setSetting, invalidateSettingsCache } from '@/lib/settings';

export async function GET() {
  try {
    await initDb();
    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const body = await req.json();
    const updates: Record<string, string> = body.settings || {};
    for (const [key, value] of Object.entries(updates)) {
      await setSetting(key, String(value ?? ''));
    }
    invalidateSettingsCache();
    return NextResponse.json({ success: true, count: Object.keys(updates).length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
