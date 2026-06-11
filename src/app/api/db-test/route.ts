import postgres from 'postgres';

export const runtime = 'nodejs';

type Diagnosis = {
  ok: boolean;
  step: 'env' | 'parse' | 'connect' | 'query' | 'done';
  message: string;
  details?: any;
  hints?: string[];
};

function maskPassword(pw: string): string {
  if (!pw) return '(rỗng)';
  if (pw.length <= 2) return '*'.repeat(pw.length);
  return pw[0] + '*'.repeat(Math.max(pw.length - 2, 1)) + pw[pw.length - 1];
}

function buildHints(rawErr: string, ctx: { user: string; host: string; port: number; rawPasswordEncoded: string; decodedPassword: string }): string[] {
  const hints: string[] = [];
  const msg = rawErr.toLowerCase();
  const { user, host, port, rawPasswordEncoded, decodedPassword } = ctx;

  if (msg.includes('password authentication failed') || msg.includes('sasl') || msg.includes('28p01')) {
    hints.push(`🔑 Sai password. Vào Supabase Dashboard → Project Settings → Database → "Reset database password" → copy password mới (đừng tự nhớ/gõ lại).`);
    hints.push(`🔍 Server đã decode password thành: ${maskPassword(decodedPassword)} (dài ${decodedPassword.length} ký tự). Kiểm tra xem ĐÚNG password DB của bạn không.`);
    if (decodedPassword !== rawPasswordEncoded) {
      hints.push(`✓ URL-encoding password OK (encoded khác decoded). Nếu password gốc có ký tự đặc biệt, đã được decode đúng.`);
    } else if (/[@#?&=%+/: !*'(){}[\]<>]/.test(rawPasswordEncoded)) {
      hints.push(`⚠️ Password gốc có ký tự đặc biệt NHƯNG chưa URL-encode! Phải encode: ! → %21, @ → %40, # → %23, ? → %3F, & → %26, % → %25, : → %3A, / → %2F, space → %20.`);
    }
    if (!user.includes('.')) {
      hints.push(`👤 Username "${user}" thiếu dấu chấm. Transaction pooler (port 6543) cần username dạng "postgres.PROJECT_REF" (PROJECT_REF là phần đầu URL Supabase, vd: postgres.abcdefghij).`);
    } else {
      hints.push(`✓ Username "${user}" định dạng OK cho Transaction pooler.`);
    }
    if (port !== 6543 && port !== 5432) {
      hints.push(`⚠️ Port ${port} không phải chuẩn (6543 = Transaction pooler, 5432 = Session/Direct). Đảm bảo dùng đúng port từ Supabase Dashboard.`);
    }
    hints.push(`💡 CÁCH FIX NHANH: Vào Supabase → Project Settings → Database → "Connection string" tab "Transaction" → bấm "Copy" (không gõ tay) → replace [YOUR-PASSWORD] bằng password thực → paste vào SUPABASE_DB_URL trong Vercel env → Redeploy.`);
  }

  if (msg.includes('tenant or user not found') || msg.includes('xx000')) {
    hints.push('👤 Username sai. Với Transaction pooler dùng "postgres.PROJECT_REF". Với Session/Direct dùng "postgres".');
    hints.push('Copy ENTIRE URI từ Supabase Dashboard, đừng tự gõ.');
  }

  if (msg.includes('enotfound') || msg.includes('eai_again') || msg.includes('econnrefused')) {
    hints.push(`🌐 Host "${host}" không resolve được. Có thể: region sai (aws-0 vs aws-1, ap-southeast vs us-east...), gõ thiếu dấu, hoặc DNS Vercel chưa cập nhật.`);
  }
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    hints.push('⏱️ Timeout — region xa hoặc cold start. Thử Transaction pooler (port 6543) thay Direct (5432).');
  }
  if (msg.includes('ssl')) {
    hints.push('🔒 SSL error — đã enable ssl=require trong config, nếu vẫn lỗi check certificate.');
  }

  if (!hints.length) hints.push('Mở Supabase Dashboard → Project Settings → Database → Connection string → copy URI Transaction pooler (port 6543) và paste vào ENV.');
  return hints;
}

export async function GET() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!url) {
    const r: Diagnosis = {
      ok: false,
      step: 'env',
      message: 'SUPABASE_DB_URL chưa được set trong env',
      hints: [
        'Vercel → Project Settings → Environment Variables → thêm SUPABASE_DB_URL',
        'Format: postgres://postgres.PROJECT_REF:PASSWORD@HOST:6543/postgres',
      ],
    };
    return Response.json(r);
  }

  // Accept postgresql:// and postgres://
  const normalizedUrl = url.replace(/^postgresql:/, 'postgres:');

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch (e: any) {
    return Response.json({
      ok: false,
      step: 'parse',
      message: 'URL không hợp lệ',
      details: e?.message,
      hints: ['Format phải là: postgres://user:password@host:port/database'],
    } as Diagnosis);
  }

  const user = decodeURIComponent(parsed.username || '');
  const decodedPassword = decodeURIComponent(parsed.password || '');
  const rawPasswordEncoded = parsed.password || '';
  const host = parsed.hostname;
  const port = parseInt(parsed.port || '5432', 10);
  const database = parsed.pathname.replace(/^\//, '') || 'postgres';

  const debugInfo = {
    scheme: parsed.protocol.replace(':', ''),
    host,
    port,
    database,
    username: user,
    password_length: decodedPassword.length,
    password_preview: maskPassword(decodedPassword),
    password_was_url_encoded: rawPasswordEncoded !== decodedPassword,
    password_special_chars: Array.from(new Set(decodedPassword.match(/[!@#$%^&*()_+={}\[\]|\\:";'<>?,./~`]/g) || [])).join(' '),
    expected_pooler_user_format: user.includes('.') ? '✓ postgres.PROJECT_REF' : '✗ thiếu dấu chấm',
  };

  // Try connect with explicit fields (bypass URL parser quirks in postgres lib)
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres({
      host,
      port,
      database,
      username: user,
      password: decodedPassword,
      ssl: host === 'localhost' || host === '127.0.0.1' ? false : 'require',
      prepare: false,
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
      details: { ...debugInfo, server_user: r?.user, server_db: r?.db, server_now: r?.now, version: String(r?.version || '').slice(0, 80) },
    } as Diagnosis);
  } catch (e: any) {
    const errMsg = e?.message || String(e);
    return Response.json({
      ok: false,
      step: 'connect',
      message: 'Connect/auth thất bại',
      details: { error: errMsg, code: e?.code, ...debugInfo },
      hints: buildHints(errMsg, { user, host, port, rawPasswordEncoded, decodedPassword }),
    } as Diagnosis);
  } finally {
    try { await sql?.end({ timeout: 2 }); } catch {}
  }
}
