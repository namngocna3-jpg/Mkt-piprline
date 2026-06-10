import { NextResponse } from 'next/server';
import { validateKey, getUsage } from '@/lib/twinClient';

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
    const v = await validateKey(apiKey);
    let usage: any = null;
    if (v.valid) {
      try { usage = await getUsage(apiKey); } catch {}
    }
    return NextResponse.json({ ...v, usage });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
