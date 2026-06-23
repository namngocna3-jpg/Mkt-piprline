import { NextResponse } from 'next/server';
import { translateLong } from '@/lib/translate';

export const maxDuration = 30;

// POST { text, from?, to? } → { translated } — dùng MyMemory FREE (không cần key).
export async function POST(req: Request) {
  try {
    const { text, from, to } = await req.json();
    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: 'Thiếu text' }, { status: 400 });
    }
    const translated = await translateLong(String(text), from || 'en', to || 'vi');
    if (translated === null) {
      return NextResponse.json({ error: 'Dịch thất bại (có thể đã quá giới hạn free 5.000 từ/ngày)' }, { status: 502 });
    }
    return NextResponse.json({ translated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
