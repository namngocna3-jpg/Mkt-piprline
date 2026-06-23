import type { FilteredArticle, ContentType } from '../research/content-filter';

// Discord webhook embed format (tương thích discohook)
interface DiscordEmbed {
  title: string;
  description: string;
  url: string;
  color: number;
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

const COLOR_MAP: Record<ContentType, number> = {
  esports: 0xe74c3c, // đỏ
  free_game: 0x2ecc71, // xanh lá
  update: 0x3498db, // xanh dương
  new_release: 0x9b59b6, // tím
  event: 0xf39c12, // vàng
  general: 0x95a5a6, // xám
};

function createEmbed(article: FilteredArticle): DiscordEmbed {
  const emoji = {
    esports: '🏆',
    free_game: '🎁',
    update: '🔄',
    new_release: '🆕',
    event: '🎉',
    general: '📰',
  };

  return {
    title: `${emoji[article.contentType]} ${article.title}`.slice(0, 256),
    description: article.summary.slice(0, 300),
    url: article.url,
    color: COLOR_MAP[article.contentType],
    thumbnail: article.imageUrl ? { url: article.imageUrl } : undefined,
    footer: { text: `${article.sourceName} • Score: ${article.score}` },
    timestamp: article.publishedAt || new Date().toISOString(),
  };
}

export async function sendToDiscord(
  webhookUrl: string,
  articles: FilteredArticle[],
  options: { batchSize?: number; delayMs?: number } = {}
): Promise<void> {
  const { batchSize = 10, delayMs = 1000 } = options;

  // Group theo contentType
  const grouped = articles.reduce((acc, a) => {
    if (!acc[a.contentType]) acc[a.contentType] = [];
    acc[a.contentType].push(a);
    return acc;
  }, {} as Record<ContentType, FilteredArticle[]>);

  for (const [type, items] of Object.entries(grouped)) {
    const embeds = items.slice(0, batchSize).map(createEmbed);

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Gaming News Bot',
          avatar_url: 'https://i.imgur.com/4M34hi2.png',
          content: `## 📢 ${type.toUpperCase().replace('_', ' ')} (${items.length} bài)`,
          embeds,
        }),
      });

      // Delay để tránh rate limit
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    } catch (err) {
      console.error(`Discord webhook error [${type}]:`, err);
    }
  }
}
