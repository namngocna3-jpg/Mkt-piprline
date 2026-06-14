import { availableImageModels } from '@/lib/ai/image-generator';

export const runtime = 'nodejs';

// Trả về model ảnh KHẢ DỤNG cho cả OpenAI + Gemini (query thực /v1/models).
export async function GET() {
  const [openai, gemini] = await Promise.all([
    availableImageModels('openai'),
    availableImageModels('gemini'),
  ]);
  return Response.json({ openai, gemini });
}
