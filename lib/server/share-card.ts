import 'server-only';

export async function shareCardPng(kind: string): Promise<Buffer> {
  const title = kind === 'graduation' ? 'Graduation' : kind === 'record' ? 'Verified record' : 'Portfolio';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F6F1E7"/>
  <rect width="1200" height="18" fill="#1A3C34"/>
  <text x="72" y="220" fill="#C8922A" font-size="28" font-family="Georgia, serif">Poket School</text>
  <text x="72" y="330" fill="#1A3C34" font-size="72" font-family="Georgia, serif">${title}</text>
  <text x="72" y="410" fill="#1A3C34" font-size="28" font-family="Georgia, serif">A verified record you can open</text>
</svg>`;
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
