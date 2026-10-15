import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const IMAGE_MODELS = ['google/gemini-2.5-flash-image', 'google/gemini-2.5-flash-image-preview'];

/**
 * One illustration with no lettering. The client confirms a Sparks spend first.
 * No key, or no picture, returns `{ fallback: true }` so the caller can draw a stand-in.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { prompt?: string; style?: string } | null;
  const prompt = (body?.prompt ?? '').toString().slice(0, 500).trim();
  const style = (body?.style ?? 'illustrated').toString().slice(0, 40);
  if (!prompt) return NextResponse.json({ error: 'Describe the picture.' }, { status: 400 });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ fallback: true, reason: 'No API key' });

  const text = `Illustration for an educational book or lesson. Style: ${style}. Depict: ${prompt}. No letters, no words, no numbers, no watermark, no captions.`;
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://poketschool.ai',
        'X-Title': 'Poket School',
      },
      body: JSON.stringify({
        model: IMAGE_MODELS[0],
        models: IMAGE_MODELS,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) return NextResponse.json({ fallback: true, reason: `Provider ${res.status}` });
    const data = await res.json();
    const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof img === 'string' && img.startsWith('data:image')) return NextResponse.json({ image: img });
    return NextResponse.json({ fallback: true, reason: 'No image returned' });
  } catch {
    return NextResponse.json({ fallback: true, reason: 'Image generation failed' });
  }
}
