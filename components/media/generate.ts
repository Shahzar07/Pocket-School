import { bearerHeaders } from '@/lib/api-client';
import { proceduralArt } from './fallback-art';
import type { CoverArtOption } from './types';

/** Ask the shared image route, then fall back to a drawn picture with no lettering. */
export async function generateIllustration(prompt: string, style?: string): Promise<{ src: string; fallback: boolean }> {
  try {
    const res = await fetch('/api/media/illustrate', {
      method: 'POST',
      headers: await bearerHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt, style }),
    });
    const data = await res.json().catch(() => ({})) as { image?: string };
    if (typeof data.image === 'string' && data.image.startsWith('data:image')) {
      return { src: data.image, fallback: false };
    }
  } catch {
    /* The stand-in still lets an author place a picture. */
  }
  return { src: proceduralArt(style || 'novel', prompt, 0), fallback: true };
}

export async function generateCoverArt(brief: string, styleId: string, refine?: string): Promise<CoverArtOption[]> {
  const prompt = [brief, refine].filter(Boolean).join('. ');
  const drawn = [0, 1, 2, 3].map(variant => ({
    id: `${styleId}-${variant}-${Math.abs(hash(prompt + variant))}`,
    styleId,
    artSrc: proceduralArt(styleId, prompt || styleId, variant),
    prompt,
    fallback: true,
  }));
  try {
    const res = await fetch('/api/media/cover', {
      method: 'POST',
      headers: await bearerHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ brief, styleId, refine }),
    });
    const data = await res.json().catch(() => ({})) as { image?: string };
    if (typeof data.image === 'string' && data.image.startsWith('data:image')) {
      drawn[0] = { ...drawn[0], artSrc: data.image, fallback: false };
    }
  } catch {
    /* Four drawn options remain. */
  }
  return drawn;
}

function hash(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i += 1) n = (n * 31 + value.charCodeAt(i)) % 100000;
  return n;
}
