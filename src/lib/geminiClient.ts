import { pickGeminiModel } from './ai/gemini-models';

export async function describeImageWithGemini(apiKey: string, base64DataUrl: string, prompt = 'Mô tả ảnh này chi tiết bằng tiếng Việt, làm rõ text/biểu đồ/đối tượng quan trọng để AI khác có thể hiểu được nội dung.') {
  const match = base64DataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error('Không nhận diện được data URL ảnh.');
  const [, mime, base64] = match;
  const model = await pickGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mime, data: base64 } },
            { text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Vision lỗi (${res.status}): ${err.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}
