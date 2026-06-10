import { NextResponse } from 'next/server';
import { webSearchAny, formatResultsBlock } from '@/lib/webSearchProviders';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { query, count, mode, preferProvider } = await req.json();
    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    const results = await webSearchAny(query, {
      count: count || 5,
      mode: mode || 'web',
      preferProvider,
    });
    return NextResponse.json({ results, block: formatResultsBlock(results), provider: results[0]?.provider });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
