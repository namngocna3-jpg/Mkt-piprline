import postgres from 'postgres';

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  '';

if (!connectionString) {
  console.warn('SUPABASE_DB_URL (or DATABASE_URL) is not defined. Database operations will fail.');
}

// Supabase pooler / Neon both work via standard Postgres TCP.
// `prepare: false` is required by Supabase's "Transaction" pooler.
export const sql = postgres(connectionString || 'postgres://dummy:dummy@localhost:5432/dummy', {
  prepare: false,
  ssl: connectionString.includes('localhost') ? false : 'require',
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export async function initDb() {
  await sql`CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, name TEXT, url TEXT, type TEXT DEFAULT 'rss', rss_url TEXT, active INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, source_id TEXT, title TEXT, url TEXT UNIQUE, summary TEXT, original_image_url TEXT, published_at TIMESTAMPTZ DEFAULT NOW(), status TEXT DEFAULT 'new', format TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, article_id TEXT, format TEXT, content TEXT, hashtags TEXT, generated_image_url TEXT, original_image_url TEXT, ai_provider TEXT, scheduled_time TEXT, status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT, key TEXT, twin_name TEXT, description TEXT, is_active INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, key_id TEXT, title TEXT, system_prompt TEXT, remote_id TEXT, namespace TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE, role TEXT, content TEXT, attachments JSONB, position INTEGER, created_at TIMESTAMPTZ DEFAULT NOW())`;
  try { await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_provider TEXT`; } catch {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, position)`; } catch {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_conv_key ON conversations(key_id, updated_at DESC)`; } catch {}
}

export async function seedDb() {
  await sql`
  INSERT INTO sources (id, name, url, type, rss_url) VALUES
    ('s1', 'TechCrunch', 'https://techcrunch.com/', 'rss', 'https://techcrunch.com/feed/'),
    ('s2', 'NFX', 'https://www.nfx.com/', 'rss', 'https://www.nfx.com/feed/'),
    ('s3', 'Indie Hackers', 'https://www.indiehackers.com/', 'rss', 'https://www.indiehackers.com/feed'),
    ('s4', 'a16z', 'https://a16z.com/', 'rss', 'https://a16z.com/feed/'),
    ('s5', 'Crunchbase News', 'https://news.crunchbase.com/', 'rss', 'https://news.crunchbase.com/feed/'),
    ('s6', 'TechStartups', 'https://techstartups.com/', 'rss', 'https://techstartups.com/feed/')
  ON CONFLICT (id) DO NOTHING;
  `;
}
