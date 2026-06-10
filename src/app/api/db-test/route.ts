import postgres from 'postgres';

export const runtime = 'nodejs';

type Diagnosis = {
  ok: boolean;
  step: 'env' | 'parse' | 'connect' | 'query' | 'done';
  message: string;
  details?: string;
  hints?: string[];
};

function diagnoseError(raw: string, urlMeta: { host: string; user: string; hasUrlEncoded: boolean; rawPassword: string }): Diagnosis {
  const hints: string[] = [];
  const msg = raw.toLowerCase();

  if (msg.includes('password authentication failed') || msg.includes('sasl') || msg.includes('28p01')) {
    hints.push('🔑 Lỗi password: mở Supabase Dashboard → Project Settings → Database → reset password và copy lại.');
    if (!urlMeta.hasUrlEncoded && /[@#?&=%+/: ]/.test(urlMeta.rawPassword)) {
      hints.push(`⚠️ Password chứa ký tự đặc biệt (${urlMeta.rawPassword.match(/[@#?&=%+/: ]/g)?.join(' ')}). Bạn PHẢI URL-encode (vd: @ → %40, # → %23, : → %3A) trước khi paste.`);
    }
    if (!urlMeta.user.includes('.')) {
      hints.push('👤 Username "postgres" (không có dấu chấm) chỉ đúng cho Direct connection. Nếu dùng Transaction pooler (port 6543), username phải dạng "postgres.PROJECT_REF" (vd: postgres.abcdefgh).');
    }
    hints.push('🌐 Region: kiểm tra host phải match region project (aws-0-ap-southeast-1, aws-0-us-east-1, v.v.).');
  }
  if (msg.includes('tenant or user not found') || msg.includes('xx000')) {
    hints.push('👤 Username sai. Với Transaction pooler dùng "postgres.PROJECT_REF". Với Session pooler / Direct dùng "postgres".');
    hints.push('Vào Supabase Dashboard → Project Settings → Database → Connection string → copy ENTIRE URI (đừng tự gõ).');
  }
  if (msg.includes('enotfound') || msg.includes('eai_again') || msg.includes('econnrefused')) {
    hints.push(`🌐 Host "${urlMeta.host}" không resolve được. Có thể region sai hoặc gõ thiếu dấu chấm.`);
  }
  if (msg.includes('timeout')) {
    hints.push('⏱️ Timeout — region xa hoặc Vercel cold start. Thử dùng Transaction pooler (port 6543) thay vì Direct (port 5432).');
  }
  if (msg.includes('ssl')) {
    hints.push('🔒 SSL error — connection string phải có ?sslmode=require hoặc connection options bật SSL.');
  }
  if (!hints.length) hints.push('Mở Supabase Dashboard → Project Settings → Database → Connection string. Copy ENTIRE URI (Transaction pooler, port 6543) và paste vào ENV.');

  return {
    ok: false,
    step: 'connect',
    message: 'Connect/auth thất bại',
    details: raw,
    hints,
  };
}

export async function GET() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!url) {
    return Response.json({
      ok: false,
      step: 'env',
      message: 'SUPABASE_DB_URL chưa được set trong env',
      hints: [
        'Vercel → Project Settings → Environment Variables → thêm SUPABASE_DB_URL',
        'Format: postgres://postgres.PROJECT_REF:PASSWORD@HOST:6543/postgres',
      ],
    });
  }

  // Parse URL safely
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e: any) {
    return Response.json({
      ok: false,
      step: 'parse',
      message: 'URL không hợp lệ',
      details: e?.message,
      hints: ['Format phải là: postgres://user:password@host:port/database'],
    });
  }

  const rawPassword = decodeURIComponent(parsed.password || '');
  const hasUrlEncoded = (parsed.password || '').includes('%');
  const urlMeta = { host: parsed.hostname, user: parsed.username, hasUrlEncoded, rawPassword };

  const masked = `${parsed.protocol}//${parsed.username}:${'*'.repeat(8)}@${parsed.host}${parsed.pathname}`;

  // Try connect + simple query
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(url, {
      prepare: false,
      ssl: url.includes('localhost') ? false : 'require',
      max: 1,
      idle_timeout: 5,
      connect_timeout: 8,
    });
    const rows = await sql`SELECT NOW() as now, current_user as user, current_database() as db, version() as version`;
    const r = rows[0] as any;
    return Response.json({
      ok: true,
      step: 'done',
      message: '✅ Kết nối DB thành công',
      details: { masked, user: r?.user, db: r?.db, now: r?.now, version: String(r?.version || '').slice(0, 80) },
    } satisfies Diagnosis & { details: any });
  } catch (e: any) {
    return Response.json(diagnoseError(e?.message || String(e), urlMeta));
  } finally {
    try { await sql?.end({ timeout: 2 }); } catch {}
  }
}
