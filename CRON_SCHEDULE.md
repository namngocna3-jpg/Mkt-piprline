# Gaming News Automation - Cron Schedule

Sử dụng cron jobs hoặc GitHub Actions để tự động cào tin theo lịch:

## Lịch đề xuất

### 1. Tin nóng (News/Updates) - Mỗi 30 phút
```bash
*/30 * * * * curl "http://localhost:3000/api/gaming-news?mode=news&minScore=15&webhook=$DISCORD_WEBHOOK"
```

### 2. Free Games - Mỗi ngày 9h sáng
```bash
0 9 * * * curl "http://localhost:3000/api/gaming-news?mode=free&webhook=$DISCORD_WEBHOOK"
```

### 3. eSports - Mỗi 2 giờ
```bash
0 */2 * * * curl "http://localhost:3000/api/gaming-news?mode=esports&minScore=20&webhook=$DISCORD_WEBHOOK"
```

### 4. Full scan - 3 lần/ngày (8h, 14h, 20h)
```bash
0 8,14,20 * * * curl "http://localhost:3000/api/gaming-news?mode=all&minScore=10&webhook=$DISCORD_WEBHOOK"
```

## Setup với Vercel Cron (Khuyên dùng)

Tạo file `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/gaming-news?mode=news&minScore=15",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/gaming-news?mode=free",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/gaming-news?mode=esports&minScore=20",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

## Parameters

- `mode`: `news` | `free` | `esports` | `all`
- `minScore`: Điểm tối thiểu (default: 10)
- `types`: Lọc theo type (vd: `esports,free_game`)
- `maxAge`: Bài cũ nhất (hours, default: 72)
- `webhook`: Discord webhook URL
- `feeds`: Custom RSS/URLs (comma-separated)

## Ví dụ custom feeds

```bash
curl "http://localhost:3000/api/gaming-news?mode=news&feeds=https://vng.com.vn/feed,https://garena.vn/rss"
```
