import { sql } from './db';

export type SettingKey =
  | 'ANTHROPIC_API_KEY'
  | 'ANTHROPIC_MODEL'
  | 'OPENAI_API_KEY'
  | 'OPENAI_MODEL'
  | 'GEMINI_API_KEY'
  | 'GEMINI_MODEL'
  | 'WRITER_PERSONA'
  | 'GROQ_API_KEY'
  | 'OPENROUTER_API_KEY'
  | 'OPENROUTER_VISION_MODEL'
  | 'HUGGINGFACE_API_KEY'
  | 'TWINEXPERT_API_KEY'
  | 'TWINEXPERT_TWIN_ID'
  | 'IMAGE_PROVIDER'
  | 'IMAGE_MODEL'
  | 'RAPID_API_KEY'
  | 'RAPIDAPI_X_HOST'
  | 'RAPIDAPI_IG_HOST'
  | 'RAPIDAPI_TIKTOK_HOST'
  | 'RAPIDAPI_YOUTUBE_HOST'
  | 'YOUTUBE_API_KEY'
  | 'PRODUCTHUNT_TOKEN'
  | 'BRAVE_API_KEY'
  | 'TAVILY_API_KEY'
  | 'SERPAPI_API_KEY'
  | 'GOOGLE_CSE_KEY'
  | 'GOOGLE_CSE_ID'
  | 'NEWSAPI_KEY'
  | 'CUSTOM_RSS_FEEDS';

const cache = new Map<string, string>();
let cacheLoaded = false;

async function loadCache() {
  if (cacheLoaded) return;
  try {
    const rows = await sql`SELECT key, value FROM app_settings`;
    for (const row of rows as any[]) {
      if (row.value) cache.set(row.key, row.value);
    }
    cacheLoaded = true;
  } catch {
    // table may not exist yet — leave cacheLoaded false so we retry next call
  }
}

export async function getSetting(key: SettingKey): Promise<string> {
  await loadCache();
  if (cache.has(key)) return cache.get(key) as string;
  const env = process.env[key];
  if (env) {
    cache.set(key, env);
    return env;
  }
  return '';
}

export async function setSetting(key: string, value: string) {
  await sql`INSERT INTO app_settings (key, value, updated_at) VALUES (${key}, ${value}, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = CURRENT_TIMESTAMP`;
  if (value) cache.set(key, value);
  else cache.delete(key);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  try {
    const rows = await sql`SELECT key, value FROM app_settings`;
    const out: Record<string, string> = {};
    for (const row of rows as any[]) out[row.key] = row.value || '';
    return out;
  } catch {
    return {};
  }
}

export function invalidateSettingsCache() {
  cache.clear();
  cacheLoaded = false;
}
