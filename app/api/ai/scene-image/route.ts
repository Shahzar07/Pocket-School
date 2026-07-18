import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** OpenRouter image-generation models, tried in order. Gemini 2.5 Flash
 * Image ("nano banana") is fast and cheap; the preview id is the fallback. */
const IMAGE_MODELS = ['google/gemini-2.5-flash-image', 'google/gemini-2.5-flash-image-preview'];

/**
 * POST /api/ai/scene-image — generate one illustrative image for a video scene.
 *
 * Body: { visual: string, title?: string, style?: string }
 * Success → { image: "data:image/...;base64,..." }
 * No key / provider can't produce an image → 200 { fallback: true } so the
 * player keeps its animated gradient stage instead of erroring.
 */
export async function POST(req: NextRequest) {
  let visual = '';
  let title = '';
  try {
    const body = await req.json();
    visual = (body.visual ?? '').toString().slice(0, 500);
    title = (body.title ?? '').toString().slice(0, 160);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!visual.trim() && !title.trim()) {
    return NextResponse.json({ error: 'visual or title required' }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ fallback: true, reason: 'No API key' });

  const prompt =
    `Educational illustration for a lesson video scene titled "${title}". ` +
    `Depict: ${visual}. ` +
    `Clean modern flat vector infographic style, bright friendly colours, clear labels, ` +
    `high detail, 16:9 wide composition, no watermark, no gibberish text.`;

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pocket-school.app',
        'X-Title': 'Pocket School',
      },
      body: JSON.stringify({
        model: IMAGE_MODELS[0],
        models: IMAGE_MODELS,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[scene-image]', res.status, err.slice(0, 200));
      return NextResponse.json({ fallback: true, reason: `Provider ${res.status}` });
    }

    const data = await res.json();
    // OpenRouter returns generated images on message.images[].image_url.url
    const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof img === 'string' && img.startsWith('data:image')) {
      return NextResponse.json({ image: img });
    }
    return NextResponse.json({ fallback: true, reason: 'No image returned' });
  } catch (err: any) {
    console.error('[scene-image]', err?.message || err);
    return NextResponse.json({ fallback: true, reason: err?.message || 'Image generation failed' });
  }
}
