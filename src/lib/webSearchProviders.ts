import { getSetting } from './settings';

export type WebSearchResult = {
  title: string;
  url: string;
  description: string;
  imageUrl?: string | null;
  publishedAt?: string;
  sourceName?: string;
  provider: string;
};

function isRateLimited(status: number) {
  return status === 429 || status === 403 || status === 503;
}

// ============ Brave ============
async function braveSearch(apiKey: string, query: string, count: number, mode: 'web' | 'news'): Promise<WebSearchResult[]> {
  const endpoint = mode === 'news'
    ? 'https://api.search.brave.com/res/v1/news/search'
    : 'https://api.search.brave.com/res/v1/web/search';
  const params = new URLSearchParams({ q: query, count: String(count) });
  if (mode === 'news') params.set('freshness', 'pd');
  const res = await fetch(`${endpoint}?${params}`, {
    headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`Brave ${res.status}`);
  }
  const data = await res.json();
  const items = data?.web?.results || data?.results || data?.news?.results || [];
  return (items as any[]).slice(0, count).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || '',
    imageUrl: r.thumbnail?.src || null,
    publishedAt: r.age || '',
    sourceName: 'Brave',
    provider: 'brave',
  }));
}

// ============ Tavily ============
async function tavilySearch(apiKey: string, query: string, count: number): Promise<WebSearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      include_answer: false,
      max_results: count,
    }),
  });
  if (!res.ok) {
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`Tavily ${res.status}`);
  }
  const json = await res.json();
  const items = json?.results || [];
  return (items as any[]).slice(0, count).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.content || r.snippet || '',
    sourceName: 'Tavily',
    publishedAt: r.published_date || '',
    provider: 'tavily',
  }));
}

// ============ SerpAPI ============
async function serpapiSearch(apiKey: string, query: string, count: number): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: query, api_key: apiKey, num: String(count), engine: 'google' });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`SerpAPI ${res.status}`);
  }
  const json = await res.json();
  const items = json?.organic_results || [];
  return (items as any[]).slice(0, count).map((r) => ({
    title: r.title || '',
    url: r.link || '',
    description: r.snippet || '',
    sourceName: r.source || 'Google',
    provider: 'serpapi',
  }));
}

// ============ Google CSE ============
async function googleCseSearch(apiKey: string, cx: string, query: string, count: number): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: query, cx, key: apiKey, num: String(Math.min(count, 10)) });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!res.ok) {
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`GoogleCSE ${res.status}`);
  }
  const json = await res.json();
  const items = json?.items || [];
  return (items as any[]).slice(0, count).map((r) => ({
    title: r.title || '',
    url: r.link || '',
    description: r.snippet || '',
    sourceName: r.displayLink || 'Google',
    provider: 'google-cse',
  }));
}

// ============ DuckDuckGo HTML (no key, free) ============
async function duckduckgoSearch(query: string, count: number): Promise<WebSearchResult[]> {
  // Use the lite/html endpoint - returns parsable HTML
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Mkt-piprline/1.0)',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) {
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`DDG ${res.status}`);
  }
  const html = await res.text();
  const { parse } = await import('node-html-parser');
  const root = parse(html);
  const results: WebSearchResult[] = [];
  const blocks = root.querySelectorAll('.result, .web-result');
  for (const b of blocks) {
    const a = b.querySelector('a.result__a, .result__title a');
    const snip = b.querySelector('.result__snippet, .result__body');
    if (!a) continue;
    let href = a.getAttribute('href') || '';
    // DDG sometimes wraps with redirect URL
    const m = href.match(/uddg=([^&]+)/);
    if (m) try { href = decodeURIComponent(m[1]); } catch {}
    results.push({
      title: a.text.trim(),
      url: href,
      description: (snip?.text || '').trim(),
      sourceName: 'DuckDuckGo',
      provider: 'duckduckgo',
    });
    if (results.length >= count) break;
  }
  return results;
}

// ============ Wikipedia (no key, free) ============
async function wikipediaSearch(query: string, count: number, lang: 'vi' | 'en' = 'en'): Promise<WebSearchResult[]> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${count}&srsearch=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiki ${res.status}`);
  const json = await res.json();
  const items = json?.query?.search || [];
  return (items as any[]).slice(0, count).map((r) => ({
    title: r.title || '',
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/\s+/g, '_'))}`,
    description: String(r.snippet || '').replace(/<[^>]+>/g, ''),
    sourceName: `Wikipedia (${lang})`,
    provider: 'wikipedia',
  }));
}

// ============ NewsAPI ============
async function newsapiSearch(apiKey: string, query: string, count: number): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: query, pageSize: String(count), sortBy: 'publishedAt', language: 'en' });
  const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!res.ok) {
    if (isRateLimited(res.status)) throw new Error(`RATE_LIMIT:${res.status}`);
    throw new Error(`NewsAPI ${res.status}`);
  }
  const json = await res.json();
  const items = json?.articles || [];
  return (items as any[]).slice(0, count).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || r.content || '',
    imageUrl: r.urlToImage || null,
    publishedAt: r.publishedAt || '',
    sourceName: r.source?.name || 'NewsAPI',
    provider: 'newsapi',
  }));
}

// ============ ROUTER ============
export type SearchMode = 'web' | 'news';
export type RouterOptions = {
  mode?: SearchMode;
  count?: number;
  preferProvider?: string;       // force a specific provider first
  maxFallbacks?: number;
};

export async function webSearchAny(query: string, opts: RouterOptions = {}): Promise<WebSearchResult[]> {
  const count = opts.count ?? 5;
  const mode = opts.mode ?? 'web';
  const errors: string[] = [];
  const tried: string[] = [];

  type Provider = { name: string; run: () => Promise<WebSearchResult[]> };
  const providers: Provider[] = [];

  // Build ordered list based on available keys
  const braveKey = await getSetting('BRAVE_API_KEY');
  if (braveKey) providers.push({ name: 'brave', run: () => braveSearch(braveKey, query, count, mode) });

  const tavilyKey = await getSetting('TAVILY_API_KEY');
  if (tavilyKey) providers.push({ name: 'tavily', run: () => tavilySearch(tavilyKey, query, count) });

  const serpKey = await getSetting('SERPAPI_API_KEY');
  if (serpKey) providers.push({ name: 'serpapi', run: () => serpapiSearch(serpKey, query, count) });

  const gKey = await getSetting('GOOGLE_CSE_KEY');
  const gCx = await getSetting('GOOGLE_CSE_ID');
  if (gKey && gCx) providers.push({ name: 'google-cse', run: () => googleCseSearch(gKey, gCx, query, count) });

  const newsKey = await getSetting('NEWSAPI_KEY');
  if (newsKey && mode === 'news') {
    providers.unshift({ name: 'newsapi', run: () => newsapiSearch(newsKey, query, count) });
  } else if (newsKey) {
    providers.push({ name: 'newsapi', run: () => newsapiSearch(newsKey, query, count) });
  }

  // Always-available providers (no key)
  providers.push({ name: 'duckduckgo', run: () => duckduckgoSearch(query, count) });
  providers.push({ name: 'wikipedia', run: () => wikipediaSearch(query, count, 'en') });

  // If user requested a specific provider first, move it to front
  if (opts.preferProvider) {
    const i = providers.findIndex(p => p.name === opts.preferProvider);
    if (i > 0) providers.unshift(providers.splice(i, 1)[0]);
  }

  const limit = opts.maxFallbacks ?? providers.length;
  for (let i = 0; i < Math.min(providers.length, limit); i++) {
    const p = providers[i];
    tried.push(p.name);
    try {
      const out = await p.run();
      if (out && out.length) return out;
      errors.push(`${p.name}: empty`);
    } catch (e: any) {
      errors.push(`${p.name}: ${e?.message || e}`);
    }
  }

  throw new Error(`All providers failed/empty. Tried: ${tried.join(',')} | Errors: ${errors.join(' | ')}`);
}

export function formatResultsBlock(results: WebSearchResult[]): string {
  if (!results.length) return '';
  const block = results.map((r, i) => `[nguồn ${i + 1}] (${r.provider}) ${r.title}\nURL: ${r.url}\nTrích: ${r.description}`).join('\n\n');
  return `<web_search_results>\n${block}\n</web_search_results>\n\nHãy trả lời người dùng, trích dẫn [nguồn N] khi dùng thông tin từ kết quả trên.`;
}
