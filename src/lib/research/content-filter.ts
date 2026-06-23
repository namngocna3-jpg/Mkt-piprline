import type { ScrapedArticle } from './rss-scraper';

// Từ khóa quan trọng (scoring)
const KEYWORDS = {
  esports: ['esports', 'giải đấu', 'tournament', 'championship', 'vcs', 'vcl', 'worlds', 'msi', 'playoff', 'chung kết'],
  updates: ['update', 'patch', 'phiên bản', 'cập nhật', 'balance', 'nerf', 'buff', 'meta', 'season', 'act'],
  freeGames: ['free', 'miễn phí', 'giveaway', 'claim', 'epic games store', 'steam free'],
  newRelease: ['launch', 'release', 'ra mắt', 'beta', 'early access', 'open beta'],
  events: ['event', 'sự kiện', 'battle pass', 'skin', 'trang phục'],
};

// Từ khóa loại bỏ
const BLACKLIST = ['review', 'đánh giá', 'top 10', 'listicle', 'rumor', 'tin đồn', 'leak rò rỉ', 'gossip'];

export type ContentType = 'esports' | 'update' | 'free_game' | 'new_release' | 'event' | 'general';

export interface FilteredArticle extends ScrapedArticle {
  contentType: ContentType;
  score: number;
  matchedKeywords: string[];
}

function scoreArticle(article: ScrapedArticle): { type: ContentType; score: number; matched: string[] } {
  const text = `${article.title} ${article.summary}`.toLowerCase();

  // Check blacklist trước
  for (const bad of BLACKLIST) {
    if (text.includes(bad.toLowerCase())) return { type: 'general', score: 0, matched: [] };
  }

  let maxScore = 0;
  let bestType: ContentType = 'general';
  let matched: string[] = [];

  // Score từng category
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    const found = keywords.filter(kw => text.includes(kw.toLowerCase()));
    const score = found.length * 10 + (text.split(' ').length > 50 ? 5 : 0); // bonus cho bài dài
    if (score > maxScore) {
      maxScore = score;
      bestType = category.replace(/([A-Z])/g, '_$1').toLowerCase().replace('_games', '_game') as ContentType;
      matched = found;
    }
  }

  return { type: bestType, score: maxScore, matched };
}

export function filterArticles(
  articles: ScrapedArticle[],
  options: {
    minScore?: number;
    types?: ContentType[];
    maxAge?: number; // hours
  } = {}
): FilteredArticle[] {
  const { minScore = 10, types, maxAge = 72 } = options;
  const cutoff = Date.now() - maxAge * 3600 * 1000;

  return articles
    .map(article => {
      const { type, score, matched } = scoreArticle(article);
      return { ...article, contentType: type, score, matchedKeywords: matched };
    })
    .filter(a => {
      // Lọc theo time
      if (a.publishedAt) {
        const ts = new Date(a.publishedAt).getTime();
        if (ts < cutoff) return false;
      }
      // Lọc theo score
      if (a.score < minScore) return false;
      // Lọc theo type
      if (types && types.length && !types.includes(a.contentType)) return false;
      return true;
    })
    .sort((a, b) => {
      // Ưu tiên: esports/free_game > score > time
      const typeWeight = { esports: 100, free_game: 90, update: 70, new_release: 60, event: 50, general: 0 };
      const diff = (typeWeight[b.contentType] || 0) - (typeWeight[a.contentType] || 0);
      if (diff !== 0) return diff;
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
    });
}
