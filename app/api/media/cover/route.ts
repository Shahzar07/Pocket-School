import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { COVER_BRAND_PALETTE } from '@/lib/reads/cover';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const IMAGE_MODELS = ['google/gemini-2.5-flash-image', 'google/gemini-2.5-flash-image-preview'];

const STYLE: Record<string, string> = {
  'illustrated-kids': 'friendly illustrated children\'s book scene, soft shapes, bright colour, no characters in distress',
  photographic: 'photographic still life, natural light, shallow depth of field',
  minimalist: 'minimalist poster, one geometric shape, lots of flat colour, no detail clutter',
  academic: 'quiet academic still life, paper, a single object of study, restrained colour',
  novel: 'literary fiction mood, dusk light, a place rather than a portrait',
};

/** Cover or thumbnail art. Lettering is forbidden so the host can draw crisp text later. */
export async function POST(request: NextRequest) {
  const denied = await enforceAiAccess(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null) as { brief?: string; styleId?: string; refine?: string } | null;
  const brief = (body?.brief ?? '').toString().slice(0, 600).trim();
  const styleId = (body?.styleId ?? 'novel').toString().slice(0, 40);
  const refine = (body?.refine ?? '').toString().slice(0, 300).trim();
  if (!brief) return NextResponse.json({ error: 'A brief is required.' }, { status: 400 });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ fallback: true, reason: 'No API key' });

  const text = [
    'Cover artwork only.',
    STYLE[styleId] ?? STYLE.novel,
    `Subject: ${brief}.`,
    refine ? `Also: ${refine}.` : '',
    COVER_BRAND_PALETTE,
    'Do not paint any letters, words, numbers, logos, or watermarks.',
  ].filter(Boolean).join(' ');

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
    return NextResponse.json({ fallback: true, reason: 'Cover generation failed' });
  }
}
