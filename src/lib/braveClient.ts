export type BraveSearchResult = {
  title: string;
  url: string;
  description: string;
};

export async function braveWebSearch(query: string, apiKey: string, count = 5): Promise<BraveSearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&country=VN&search_lang=vi`;
  const res = await fetch(url, { headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Brave search failed (${res.status})`);
  const json = await res.json();
  const results = json?.web?.results || [];
  return (results as any[]).slice(0, count).map(r => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || '',
  }));
}

export function formatBraveResults(results: BraveSearchResult[]): string {
  if (!results.length) return '';
  const block = results
    .map((r, i) => `[nguồn ${i + 1}] ${r.title}\nURL: ${r.url}\nTrích: ${r.description}`)
    .join('\n\n');
  return `<web_search_results>\n${block}\n</web_search_results>\n\nHãy trả lời người dùng, trích dẫn [nguồn N] khi dùng thông tin từ kết quả trên.`;
}
