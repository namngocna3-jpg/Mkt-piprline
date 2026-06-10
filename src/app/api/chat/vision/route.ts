import { describeImage } from '@/lib/visionProviders';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { dataUrl, prompt } = await req.json();
    if (!dataUrl || typeof dataUrl !== 'string') {
      return Response.json({ error: 'Thiếu dataUrl' }, { status: 400 });
    }
    const result = await describeImage(dataUrl, prompt);
    return Response.json({ text: result.text, provider: result.provider });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.startsWith('NO_PROVIDER:')) {
      return new Response(msg.replace('NO_PROVIDER:', ''), { status: 400 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
