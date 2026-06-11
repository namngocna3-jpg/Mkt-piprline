import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Chỉ trả bài CHƯA xử lý (status='new'); scan đã dọn bài cũ nên đây = batch hiện tại.
    // KHÔNG kéo cột ảnh base64 nặng ở list (chỉ cần khi viết) → nhanh hơn.
    const articles = await sql`
      SELECT a.id, a.source_id, a.title, a.url, a.summary,
             a.ai_summary, a.published_at, a.created_at, a.status,
             s.name as source_name, s.type as source_type
      FROM articles a JOIN sources s ON a.source_id = s.id
      WHERE a.status = 'new'
      ORDER BY COALESCE(a.published_at, a.created_at) DESC
      LIMIT 100
    `;
    return NextResponse.json({ articles });
  } catch (e: any) {
    return NextResponse.json({ articles: [], error: e?.message || String(e) }, { status: 500 });
  }
}
