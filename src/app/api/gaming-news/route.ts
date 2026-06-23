import { scrapeFreeGames } from '@/lib/research/free-games-scraper';
import { scrapeEsportsVN } from '@/lib/research/esports-vn-scraper';
import { scrapeVnGaming, scrapeGameTitles, scrapeCustomFeeds } from '@/lib/research/game-vn-scraper';
import { scrapeGamingNews } from '@/lib/research/gaming-scraper';
import { filterArticles, type ContentType } from '@/lib/research/content-filter';
import { sendToDiscord } from '@/lib/discord/webhook';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'news'; // news | free | esports | all
  const webhook = searchParams.get('webhook') || process.env.DISCORD_WEBHOOK_URL || '';
  const customFeeds = searchParams.get('feeds') || ''; // comma-separated URLs

  try {
    let articles: any[] = [];

    // Chọn nguồn theo mode
    switch (mode) {
      case 'free':
        articles = await scrapeFreeGames();
        break;
      case 'esports':
        articles = await scrapeEsportsVN();
        break;
      case 'news':
        const [vn, intl, titles] = await Promise.all([
          scrapeVnGaming(),
          scrapeGamingNews(),
          scrapeGameTitles(),
        ]);
        articles = [...vn, ...intl, ...titles];
        break;
      case 'all':
        const [free, esports, vn2, intl2, titles2, custom] = await Promise.all([
          scrapeFreeGames(),
          scrapeEsportsVN(),
          scrapeVnGaming(),
          scrapeGamingNews(),
          scrapeGameTitles(),
          scrapeCustomFeeds(customFeeds),
        ]);
        articles = [...free, ...esports, ...vn2, ...intl2, ...titles2, ...custom];
        break;
    }

    // Lọc bài với score tối thiểu
    const minScore = parseInt(searchParams.get('minScore') || '10');
    const types = searchParams.get('types')?.split(',') as ContentType[] | undefined;
    const maxAge = parseInt(searchParams.get('maxAge') || '72');

    const filtered = filterArticles(articles, { minScore, types, maxAge });

    // Gửi Discord nếu có webhook
    if (webhook && filtered.length > 0) {
      await sendToDiscord(webhook, filtered);
    }

    return NextResponse.json({
      success: true,
      mode,
      total: articles.length,
      filtered: filtered.length,
      articles: filtered.slice(0, 50),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
