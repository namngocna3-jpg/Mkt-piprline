import { NextResponse } from 'next/server';
import { listTwins } from '@/lib/ai/twinexpert-writer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('apiKey') || undefined;
    const twins = await listTwins(apiKey || undefined);
    return NextResponse.json({ twins });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
