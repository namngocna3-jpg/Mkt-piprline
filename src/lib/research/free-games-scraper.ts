import { parse as parseHtml } from 'node-html-parser';
import type { ScrapedArticle } from './rss-scraper';

// Steam free games (qua steamdb.info - reliable hơn official RSS)
async function scrapeSteamFree(): Promise<ScrapedArticle[]> {
  try {
    const res = await fetch('https://store.steampowered.com/search/?maxprice=free&specials=1', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const root = parseHtml(html);
    const items = root.querySelectorAll('#search_resultsRows > a').slice(0, 10);
    return items.map(el => ({
      title: `🎮 FREE: ${el.querySelector('.title')?.text?.trim() || 'Game'}`,
      url: el.getAttribute('href')?.split('?')[0] || '',
      summary: `Đang miễn phí trên Steam! ${el.querySelector('.search_discount')?.text?.trim() || ''}`,
      imageUrl: el.querySelector('img')?.getAttribute('src') || null,
      publishedAt: new Date().toISOString(),
      sourceName: 'Steam Free',
    })).filter(a => a.url);
  } catch { return []; }
}

// Epic Games free (official API endpoint - public)
async function scrapeEpicFree(): Promise<ScrapedArticle[]> {
  try {
    const res = await fetch('https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=VN&allowCountries=VN', {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    const games = data?.data?.Catalog?.searchStore?.elements || [];
    return games
      .filter((g: any) => g.promotions?.promotionalOffers?.length)
      .slice(0, 5)
      .map((g: any) => {
        const promo = g.promotions.promotionalOffers[0]?.promotionalOffers[0];
        const end = promo?.endDate ? new Date(promo.endDate).toLocaleDateString('vi-VN') : '';
        return {
          title: `🎁 FREE: ${g.title}`,
          url: `https://store.epicgames.com/en-US/p/${g.catalogNs?.mappings?.[0]?.pageSlug || g.productSlug}`,
          summary: `Miễn phí 100% trên Epic Games${end ? ` đến ${end}` : ''}! ${g.description || ''}`.slice(0, 500),
          imageUrl: g.keyImages?.find((i: any) => i.type === 'OfferImageWide')?.url || null,
          publishedAt: promo?.startDate || new Date().toISOString(),
          sourceName: 'Epic Games Free',
        };
      });
  } catch { return []; }
}

export async function scrapeFreeGames(): Promise<ScrapedArticle[]> {
  const [steam, epic] = await Promise.all([scrapeSteamFree(), scrapeEpicFree()]);
  return [...epic, ...steam]; // Epic ưu tiên trước
}
