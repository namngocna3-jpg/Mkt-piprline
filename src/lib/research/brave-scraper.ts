import { webSearchAny, WebSearchResult } from '../webSearchProviders';

export type BraveResult = {
  title: string;
  url: string;
  description: string;
  imageUrl: string | null;
  publishedAt: string;
  sourceName: string;
};

const AI_QUERIES = [
  'new AI tool launch',
  'AI agent startup',
  'AI marketing feature',
  'artificial intelligence new app',
  'generative AI update',
];

function toBraveResult(r: WebSearchResult, fallbackSource: string): BraveResult {
  return {
    title: r.title,
    url: r.url,
    description: r.description,
    imageUrl: r.imageUrl ?? null,
    publishedAt: r.publishedAt || new Date().toISOString(),
    sourceName: r.sourceName || fallbackSource,
  };
}

async function multiSearch(query: string, mode: 'web' | 'news' = 'news'): Promise<WebSearchResult[]> {
  try {
    return await webSearchAny(query, { mode, count: 10, freshness: 'week' });
  } catch {
    return [];
  }
}

export async function searchX(): Promise<BraveResult[]> {
  const queries = AI_QUERIES.map((q) => `site:x.com ${q}`);
  const results = await Promise.allSettled(queries.map((q) => multiSearch(q)));
  return results
    .filter((r): r is PromiseFulfilledResult<WebSearchResult[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .map((r) => toBraveResult(r, 'X (Twitter)'))
    .map((r) => ({ ...r, sourceName: 'X (Twitter)' }));
}

export async function searchLinkedIn(): Promise<BraveResult[]> {
  const queries = AI_QUERIES.map((q) => `site:linkedin.com ${q}`);
  const results = await Promise.allSettled(queries.map((q) => multiSearch(q)));
  return results
    .filter((r): r is PromiseFulfilledResult<WebSearchResult[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .map((r) => toBraveResult(r, 'LinkedIn'))
    .map((r) => ({ ...r, sourceName: 'LinkedIn' }));
}

export async function searchGeneral(): Promise<BraveResult[]> {
  const results = await Promise.allSettled(AI_QUERIES.map((q) => multiSearch(q)));
  return results
    .filter((r): r is PromiseFulfilledResult<WebSearchResult[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .map((r) => toBraveResult(r, r.sourceName || 'Search'));
}

export async function searchAll(): Promise<BraveResult[]> {
  const [xResults, linkedInResults, generalResults] = await Promise.all([
    searchX(),
    searchLinkedIn(),
    searchGeneral(),
  ]);

  const seen = new Set<string>();
  const all: BraveResult[] = [];
  for (const r of [...xResults, ...linkedInResults, ...generalResults]) {
    if (r.url && !seen.has(r.url)) {
      seen.add(r.url);
      all.push(r);
    }
  }
  return all;
}
