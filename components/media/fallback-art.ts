import { BRAND_FILLS } from '@/lib/reads/cover';

/** Drawn stand-in when the image model is unavailable. No letters are painted into the picture. */
export function proceduralArt(styleId: string, seed: string, variant = 0): string {
  const accent = BRAND_FILLS[(hash(seed + styleId) + variant) % BRAND_FILLS.length] ?? '#1E6A83';
  const paper = '#E9F7FA';
  const ink = '#203337';
  const shape = shapeFor(styleId, accent, ink, variant);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="${paper}"/>${shape}<circle cx="${140 + variant * 30}" cy="180" r="${70 + variant * 8}" fill="${accent}" opacity="0.85"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function shapeFor(styleId: string, accent: string, ink: string, variant: number): string {
  if (styleId === 'illustrated-kids') {
    return `<rect x="180" y="420" width="440" height="360" rx="48" fill="${accent}"/><circle cx="320" cy="560" r="28" fill="${ink}"/><circle cx="480" cy="560" r="28" fill="${ink}"/><path d="M330 680 Q400 740 470 680" fill="none" stroke="${ink}" stroke-width="12"/>`;
  }
  if (styleId === 'photographic') {
    return `<rect x="0" y="640" width="800" height="560" fill="${ink}" opacity="0.35"/><rect x="0" y="780" width="800" height="180" fill="${accent}" opacity="0.55"/><circle cx="560" cy="280" r="90" fill="${accent}"/>`;
  }
  if (styleId === 'minimalist') {
    return `<rect x="${220 + variant * 10}" y="360" width="280" height="520" fill="${ink}"/>`;
  }
  if (styleId === 'academic') {
    return `<rect x="120" y="300" width="560" height="16" fill="${ink}" opacity="0.4"/><rect x="120" y="360" width="420" height="10" fill="${ink}" opacity="0.25"/><rect x="120" y="400" width="480" height="10" fill="${ink}" opacity="0.25"/><rect x="120" y="440" width="360" height="10" fill="${ink}" opacity="0.25"/><rect x="120" y="700" width="560" height="220" fill="${accent}" opacity="0.35"/>`;
  }
  return `<path d="M0 760 L260 520 L420 680 L560 460 L800 700 L800 1200 L0 1200 Z" fill="${ink}" opacity="0.8"/><circle cx="610" cy="240" r="54" fill="${accent}"/>`;
}

function hash(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i += 1) n = (n * 33 + value.charCodeAt(i)) % 100000;
  return n;
}
