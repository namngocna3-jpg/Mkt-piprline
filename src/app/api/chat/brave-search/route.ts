import { NextResponse } from 'next/server';
import { braveWebSearch, formatBraveResults } from '@/lib/braveClient';
import { getSetting } from '@/lib/settings';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    const apiKey = await getSetting('BRAVE_API_KEY');
    if (!apiKey) return NextResponse.json({ error: 'Brave API key chưa cấu hình trong /settings' }, { status: 400 });
    const results = await braveWebSearch(query, apiKey, 5);
    const block = formatBraveResults(results);
    return NextResponse.json({ results, block });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
