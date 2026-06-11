import { sql, initDb } from '@/lib/db';
import { generateIdeas } from '@/lib/ai/ideas';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { topic, count } = await req.json();
    if (!topic || !String(topic).trim()) return Response.json({ error: 'Nhập chủ đề' }, { status: 400 });
    const n = Math.max(1, Math.min(Number(count) || 8, 20));

    try { await initDb(); } catch {}

    const { ideas, error } = await generateIdeas(String(topic).trim(), n);
    if (!ideas.length) return Response.json({ error: error || 'Không sinh được ý tưởng' }, { status: 400 });

    // Tạo source "Brainstorm" + chèn ý tưởng như bài (status='new') để chảy vào bước 2.
    const srcName = '💡 Brainstorm';
    let [source] = await sql`SELECT id FROM sources WHERE name = ${srcName}`;
    if (!source) {
      const sid = 's_' + Math.random().toString(36).substring(7);
      await sql`INSERT INTO sources (id, name, type) VALUES (${sid}, ${srcName}, 'idea')`;
      source = { id: sid };
    }

    let count2 = 0;
    for (const idea of ideas) {
      const id = 'a_' + Math.random().toString(36).substring(7);
      // url giả unique để tránh trùng + cho phép nhiều lần brainstorm
      const fakeUrl = `idea://${encodeURIComponent(topic)}/${id}`;
      try {
        await sql`INSERT INTO articles (id, source_id, title, url, summary, published_at)
          VALUES (${id}, ${source.id}, ${idea.title}, ${fakeUrl}, ${idea.summary}, NOW())
          ON CONFLICT DO NOTHING`;
        count2++;
      } catch { /* skip */ }
    }

    return Response.json({ success: true, count: count2, ideas });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
