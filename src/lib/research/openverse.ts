// Openverse API — FREE, KHÔNG cần API key. Tìm ảnh có giấy phép mở (CC) — an toàn dùng.
// Dùng làm nguồn ảnh minh họa "thật" (thay/bổ sung cho ảnh AI sinh ra).
export type OpenverseImage = {
  url: string;          // ảnh gốc
  thumbnail: string;    // ảnh nhỏ
  title: string;
  creator: string;
  license: string;
  sourcePage: string;   // trang gốc (ghi nguồn nếu cần)
};

export async function searchOpenverse(query: string, count = 3): Promise<OpenverseImage[]> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}`
      + `&page_size=${Math.min(count, 20)}&license_type=commercial&mature=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mkt-piprline/1.0 (content-pipeline)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.results || []).map((r: any) => ({
      url: r.url,
      thumbnail: r.thumbnail || r.url,
      title: r.title || '',
      creator: r.creator || '',
      license: `${r.license || ''} ${r.license_version || ''}`.trim().toUpperCase(),
      sourcePage: r.foreign_landing_url || r.url,
    })).filter((i: OpenverseImage) => i.url);
  } catch {
    return [];
  }
}

// Lấy 1 ảnh CC phù hợp nhất cho chủ đề (dùng làm fallback khi không sinh được ảnh AI).
export async function getOpenverseImage(topic: string): Promise<string | null> {
  const results = await searchOpenverse(topic, 1);
  return results[0]?.url || null;
}
