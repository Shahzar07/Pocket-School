import type { CoverFont, CoverPlacement } from '@/lib/reads/cover';

/** Draw title and author as real text on top of text-free art, at the sizes the shelf uses. */
export async function composeCoverSizes(opts: {
  artSrc: string;
  title: string;
  author: string;
  placement: CoverPlacement;
  font: CoverFont;
  brand: boolean;
}): Promise<{ tile: string; hero: string; thumb: string }> {
  const [tile, hero, thumb] = await Promise.all([
    paint(opts, 600, 900),
    paint(opts, 1600, 700),
    paint(opts, 240, 360),
  ]);
  return { tile, hero, thumb };
}

async function paint(opts: {
  artSrc: string;
  title: string;
  author: string;
  placement: CoverPlacement;
  font: CoverFont;
  brand: boolean;
}, width: number, height: number): Promise<string> {
  const image = await loadImage(opts.artSrc);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw a cover.');
  const scale = Math.max(width / image.width, height / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  const scrim = ctx.createLinearGradient(0, 0, 0, height);
  scrim.addColorStop(0, 'rgba(0,0,0,0.15)');
  scrim.addColorStop(0.45, 'rgba(0,0,0,0.05)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);

  const font = opts.font === 'serif' ? 'Georgia, "Times New Roman", serif' : opts.font === 'rounded' ? 'Verdana, sans-serif' : 'ui-sans-serif, sans-serif';
  const titleSize = Math.round(width * (width > 1000 ? 0.055 : 0.075));
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (opts.brand) {
    ctx.font = `700 ${Math.max(12, Math.round(titleSize * 0.34))}px ${font}`;
    ctx.fillText('POKET READS', pad(width), opts.placement === 'top' ? pad(width) + titleSize * 3.2 : pad(width));
  }
  ctx.font = `700 ${titleSize}px ${font}`;
  const lines = wrap(ctx, opts.title, width - pad(width) * 2);
  const block = lines.length * titleSize * 1.15 + titleSize * 0.8;
  const y = opts.placement === 'top' ? pad(width) : opts.placement === 'center' ? (height - block) / 2 : height - pad(width) - block;
  lines.forEach((line, index) => ctx.fillText(line, pad(width), y + index * titleSize * 1.15));
  ctx.font = `500 ${Math.round(titleSize * 0.42)}px ${font}`;
  ctx.fillText(opts.author, pad(width), y + lines.length * titleSize * 1.15 + 8);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function pad(width: number): number {
  return Math.round(width * 0.07);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the cover art.'));
    image.src = src;
  });
}
