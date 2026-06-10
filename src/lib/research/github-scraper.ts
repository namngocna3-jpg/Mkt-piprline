import type { ScrapedArticle } from './rss-scraper';
import { parse } from 'node-html-parser';

const TOPICS = ['ai', 'llm', 'machine-learning', 'agent', 'generative-ai'];

export async function scrapeGithubTrending(): Promise<ScrapedArticle[]> {
  const out: ScrapedArticle[] = [];
  const seen = new Set<string>();

  // 1. GitHub trending (daily, scrape HTML)
  for (const range of ['daily', 'weekly'] as const) {
    try {
      const res = await fetch(`https://github.com/trending?since=${range}`, {
        headers: { 'User-Agent': 'Mkt-piprline/1.0', 'Accept': 'text/html' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const root = parse(html);
      const items = root.querySelectorAll('article.Box-row');
      for (const it of items) {
        const a = it.querySelector('h2 a');
        const desc = it.querySelector('p');
        const stars = it.querySelector('a[href$="/stargazers"]');
        if (!a) continue;
        const href = a.getAttribute('href') || '';
        const repo = href.replace(/^\//, '').trim();
        const url = `https://github.com/${repo}`;
        if (seen.has(url)) continue;
        seen.add(url);
        out.push({
          title: repo,
          url,
          summary: `⭐ ${(stars?.text || '0').trim()} · trending ${range}\n${(desc?.text || '').trim().slice(0, 300)}`,
          imageUrl: null,
          publishedAt: new Date().toISOString(),
          sourceName: 'GitHub Trending',
        });
      }
    } catch {}
  }

  // 2. GitHub API: recently-pushed top repos for AI topics (free, no auth needed for low-volume)
  for (const topic of TOPICS) {
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const q = `topic:${topic} pushed:>${since}`;
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mkt-piprline/1.0', 'Accept': 'application/vnd.github+json' } });
      if (!res.ok) continue;
      const json = await res.json();
      for (const r of (json?.items || [])) {
        if (seen.has(r.html_url)) continue;
        seen.add(r.html_url);
        out.push({
          title: r.full_name,
          url: r.html_url,
          summary: `⭐ ${r.stargazers_count?.toLocaleString() || 0} · topic ${topic}\n${(r.description || '').slice(0, 300)}`,
          imageUrl: r.owner?.avatar_url || null,
          publishedAt: r.pushed_at || new Date().toISOString(),
          sourceName: 'GitHub',
        });
      }
    } catch {}
  }

  return out.slice(0, 40);
}
