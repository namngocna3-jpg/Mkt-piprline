// Catalog model + giá tham khảo để user ước tính chi phí (tính credit).
// Giá là USD trên 1 TRIỆU token (input/output), CHỈ MANG TÍNH THAM KHẢO —
// kiểm tra trang provider để có giá chính xác.

export type ModelDef = {
  id: string;
  label: string;
  inPrice: number;   // USD / 1M input tokens
  outPrice: number;  // USD / 1M output tokens
  note?: string;
};

export const TEXT_MODELS: Record<string, ModelDef[]> = {
  claude: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — mạnh nhất', inPrice: 15, outPrice: 75 },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — cân bằng', inPrice: 3, outPrice: 15 },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — rẻ & nhanh', inPrice: 1, outPrice: 5 },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o — mạnh', inPrice: 2.5, outPrice: 10 },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini — rẻ & nhanh', inPrice: 0.15, outPrice: 0.6 },
    { id: 'gpt-4.1', label: 'GPT-4.1', inPrice: 2, outPrice: 8 },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini — rẻ', inPrice: 0.4, outPrice: 1.6 },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — rẻ, có free tier', inPrice: 0.3, outPrice: 2.5, note: 'Có hạn mức free' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite — rẻ nhất', inPrice: 0.1, outPrice: 0.4 },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — mạnh', inPrice: 1.25, outPrice: 10 },
  ],
};

export const IMAGE_MODELS: Record<string, ModelDef[]> = {
  pollinations: [
    { id: 'flux', label: 'Flux — chất lượng cao', inPrice: 0, outPrice: 0, note: 'MIỄN PHÍ · không cần key' },
    { id: 'turbo', label: 'Turbo — nhanh', inPrice: 0, outPrice: 0, note: 'MIỄN PHÍ · không cần key' },
  ],
  openverse: [
    { id: 'cc-photo', label: 'Ảnh thật giấy phép CC', inPrice: 0, outPrice: 0, note: 'MIỄN PHÍ · không cần key' },
  ],
  openai: [
    { id: 'dall-e-3', label: 'DALL·E 3 — chất lượng cao', inPrice: 0, outPrice: 0, note: '~$0.04/ảnh (1024²)' },
    { id: 'gpt-image-1', label: 'GPT Image 1 — mới', inPrice: 0, outPrice: 0, note: '~$0.04/ảnh' },
    { id: 'dall-e-2', label: 'DALL·E 2 — rẻ hơn', inPrice: 0, outPrice: 0, note: '~$0.02/ảnh' },
  ],
  gemini: [
    { id: 'imagen-4.0-generate-001', label: 'Imagen 4 — mới nhất', inPrice: 0, outPrice: 0, note: '~$0.04/ảnh' },
    { id: 'imagen-3.0-generate-002', label: 'Imagen 3 — ổn định', inPrice: 0, outPrice: 0, note: '~$0.03/ảnh' },
  ],
};

// 1 bài Facebook ~ prompt 1500 token + output 600 token
export const EST_IN_TOKENS = 1500;
export const EST_OUT_TOKENS = 600;

export function estCostPerPost(m: ModelDef): number {
  return (EST_IN_TOKENS / 1e6) * m.inPrice + (EST_OUT_TOKENS / 1e6) * m.outPrice;
}

export function formatCost(usd: number): string {
  if (usd <= 0) return 'Miễn phí';
  if (usd < 0.001) return `~$${usd.toFixed(5)}/bài`;
  if (usd < 0.01) return `~$${usd.toFixed(4)}/bài`;
  return `~$${usd.toFixed(3)}/bài`;
}

export function findModel(provider: string, id: string): ModelDef | undefined {
  return (TEXT_MODELS[provider] || []).find(m => m.id === id);
}
