import 'server-only';
import { BRAND, FONT } from '@/lib/brand-theme';

export async function shareCardPng(kind: string): Promise<Buffer> {
  const title = kind === 'graduation' ? 'Graduation' : kind === 'record' ? 'Verified record' : 'Portfolio';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.blueDeep}"/>
      <stop offset="52%" stop-color="${BRAND.primary}"/>
      <stop offset="100%" stop-color="${BRAND.blueBright}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${BRAND.bg}"/>
  <rect width="1200" height="18" fill="url(#brand)"/>
  <text x="72" y="220" fill="${BRAND.primary}" font-size="28" font-family="${FONT.sans}, sans-serif">Poket School</text>
  <text x="72" y="330" fill="${BRAND.ink}" font-size="72" font-family="${FONT.display}, sans-serif">${title}</text>
  <text x="72" y="410" fill="${BRAND.ink}" font-size="28" font-family="${FONT.sans}, sans-serif">A verified record you can open</text>
</svg>`;
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
