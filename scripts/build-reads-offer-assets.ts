/**
 * Builds the Poket Reads sales-letter stills.
 *
 * Covers use the Poket blue jackets in lib/reads-offer-media.ts and draw the
 * title as real text, the same idea as Book Studio's cover compose.
 * Device frames are filled from screenshots in /tmp/reads-shots when those files exist.
 *
 *   npx tsx scripts/build-reads-offer-assets.ts
 */
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  BOOK_3D_HEIGHT,
  BOOK_3D_WIDTH,
  COVER_HEIGHT,
  COVER_WIDTH,
  EBOOK_HEIGHT,
  EBOOK_WIDTH,
  FAN_HEIGHT,
  FAN_WIDTH,
  LAPTOP_HEIGHT,
  LAPTOP_WIDTH,
  OFFER_JACKETS,
  PHONE_HEIGHT,
  PHONE_WIDTH,
  TABLET_HEIGHT,
  TABLET_WIDTH,
} from '../lib/reads-offer-media';
import { CYAN, light } from '../lib/design/tokens';
import { READS_OFFER_HEADLINE_LINES, ownOrReadLine } from '../lib/reads-offer';
import { publishedBooks } from '../lib/reads/seed';

const ROOT = path.join(process.cwd(), 'public/reads/offer');
const SHOTS = '/tmp/reads-shots';

const ORDER = [
  'yellow-window',
  'blue-notebook',
  'harbour-light',
  'malacca',
  'cells-to-systems',
  'plain-contract',
] as const;

const KICKER: Record<string, string> = {
  'yellow-window': "CHILDREN'S",
  'blue-notebook': 'PRIMARY',
  'harbour-light': 'A NOVEL',
  malacca: 'HISTORY',
  'cells-to-systems': 'IGCSE BIOLOGY',
  'plain-contract': 'LLB LAW',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleLines(title: string): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 14 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

async function writeStill(input: Buffer, file: string, width: number, height: number) {
  const fitted = await sharp(input)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const webp = file.endsWith('.webp') ? file : `${file}.webp`;
  await sharp(fitted).webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(webp);
  await sharp(fitted).avif({ quality: 48, effort: 4 }).toFile(webp.replace(/\.webp$/, '.avif'));
}

function gradientSvg(from: string, to: string, accent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <defs>
    <linearGradient id="cover" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#cover)"/>
  <rect width="16" height="${COVER_HEIGHT}" fill="#000" opacity="0.28"/>
  <circle cx="620" cy="20" r="150" fill="${accent}" opacity="0.42"/>
</svg>`;
}

function letteringSvg(title: string, author: string, kicker: string, accent: string): string {
  const lines = titleLines(title);
  const size = lines.length > 2 ? 58 : 68;
  const start = COVER_HEIGHT - 88 - lines.length * size * 1.05;
  const tspans = lines.map((line, index) => {
    const y = start + index * size * 1.08;
    return `<tspan x="48" y="${y}">${escapeXml(line)}</tspan>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#000" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#scrim)"/>
  <text x="48" y="78" fill="${accent}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="22" font-weight="700" letter-spacing="3.2">${escapeXml(kicker)}</text>
  <text fill="#ffffff" font-family="Liberation Serif, DejaVu Serif, serif" font-size="${size}" font-weight="700">${tspans}</text>
  <text x="48" y="${COVER_HEIGHT - 52}" fill="#ffffff" fill-opacity="0.86" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="24" font-weight="600">${escapeXml(author)}</text>
</svg>`;
}

function kidsShape(accent: string): string {
  return `<rect x="180" y="430" width="280" height="220" rx="28" fill="${accent}" opacity="0.95"/>
  <rect x="220" y="470" width="200" height="140" rx="12" fill="${light.bg}"/>
  <circle cx="280" cy="530" r="16" fill="${CYAN.ink}"/>
  <circle cx="360" cy="530" r="16" fill="${CYAN.ink}"/>`;
}

async function renderCover(id: string): Promise<Buffer> {
  const book = publishedBooks().find(item => item.id === id);
  const jacket = OFFER_JACKETS[id as keyof typeof OFFER_JACKETS];
  if (!book || !jacket) throw new Error(`Missing published book ${id}`);
  const picture = id === 'yellow-window' ? kidsShape(jacket.accent) : '';
  const svg = gradientSvg(jacket.from, jacket.to, jacket.accent).replace('</svg>', `${picture}</svg>`);
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const top = jacket.from.toUpperCase();
  const kickerFill = top === light.blueBright.toUpperCase()
    ? CYAN.ink
    : top === light.primary.toUpperCase()
      ? light.onPrimary
      : CYAN.fill;
  const letters = Buffer.from(letteringSvg(book.title, book.author, KICKER[id] ?? 'POKET READS', kickerFill));
  return sharp(base).composite([{ input: letters, top: 0, left: 0 }]).png().toBuffer();
}

async function physicalBook(cover: Buffer): Promise<Buffer> {
  const coverW = 520;
  const coverH = 780;
  const spineW = 52;
  const pageW = 34;
  const flatW = spineW + coverW + pageW;
  const jacket = await sharp(cover).resize(coverW, coverH).png().toBuffer();
  const spine = await sharp(jacket)
    .extract({ left: 0, top: 0, width: 24, height: coverH })
    .resize(spineW, coverH)
    .modulate({ brightness: 0.42, saturation: 0.8 })
    .png()
    .toBuffer();
  const pages = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${coverH}">
  <rect width="${pageW}" height="${coverH}" fill="#f6f1e8"/>
  ${Array.from({ length: 36 }, (_, i) => `<line x1="2" y1="${18 + i * 21}" x2="${pageW - 2}" y2="${18 + i * 21}" stroke="#e4d8c6" stroke-width="2"/>`).join('')}
</svg>`);
  const flat = await sharp({
    create: { width: flatW, height: coverH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: spine, left: 0, top: 0 },
    { input: jacket, left: spineW, top: 0 },
    { input: pages, left: spineW + coverW, top: 0 },
  ]).png().toBuffer();

  const rotated = await sharp(flat).rotate(-14, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(rotated).metadata();
  const shadow = await sharp(rotated).ensureAlpha().modulate({ brightness: 0 }).blur(16).png().toBuffer();
  const width = meta.width ?? 700;
  const height = meta.height ?? 900;
  return sharp({
    create: { width: width + 80, height: height + 90, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: shadow, left: 54, top: 64 },
    { input: rotated, left: 36, top: 30 },
  ]).png().toBuffer();
}

async function ebook(cover: Buffer, caption: string): Promise<Buffer> {
  const screenW = 520;
  const screenH = 780;
  const jacket = await sharp(cover).resize(screenW, screenH, { fit: 'cover' }).png().toBuffer();
  const bezel = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${EBOOK_WIDTH}" height="${EBOOK_HEIGHT}">
  <rect x="70" y="36" width="620" height="860" rx="48" fill="${light.ink}"/>
  <rect x="94" y="60" width="572" height="812" rx="28" fill="#0e171b"/>
  <text x="380" y="940" text-anchor="middle" fill="#3e5257" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="22" font-weight="700">${escapeXml(caption)}</text>
</svg>`);
  const mask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${screenW}" height="${screenH}">
  <rect width="${screenW}" height="${screenH}" rx="18" fill="#fff"/>
</svg>`);
  const rounded = await sharp(jacket).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(bezel).composite([{ input: rounded, left: 120, top: 76 }]).png().toBuffer();
}

async function fan(covers: Buffer[]): Promise<Buffer> {
  const tileW = 300;
  const tileH = 450;
  const angles = [-24, -14, -5, 6, 15, 24];
  const placed = await Promise.all(covers.map(async (cover, index) => {
    const tile = await sharp(cover).resize(tileW, tileH).png().toBuffer();
    return sharp(tile).rotate(angles[index] ?? 0, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }));
  const canvas = sharp({
    create: { width: FAN_WIDTH, height: FAN_HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const composites = [];
  for (let index = 0; index < placed.length; index += 1) {
    const meta = await sharp(placed[index]).metadata();
    const left = Math.round(40 + index * 210 - ((meta.width ?? tileW) - tileW) / 2);
    const top = Math.round(180 - ((meta.height ?? tileH) - tileH) / 2);
    composites.push({ input: placed[index], left: Math.max(0, left), top: Math.max(0, top) });
  }
  return canvas.composite(composites).png().toBuffer();
}

async function og(covers: Buffer[]): Promise<Buffer> {
  const thumbs = await Promise.all(covers.slice(0, 4).map(cover => sharp(cover).resize(168, 252).png().toBuffer()));
  const board = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="og" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light.blueDeep}"/>
      <stop offset="0.55" stop-color="${light.primary}"/>
      <stop offset="1" stop-color="${light.blueBright}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#og)"/>
  <rect x="72" y="164" width="84" height="8" rx="4" fill="${CYAN.fill}"/>
  <text x="72" y="210" fill="#ffffff" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="22" font-weight="700" letter-spacing="3">POKET READS</text>
  <text x="72" y="300" fill="#ffffff" font-family="Liberation Serif, DejaVu Serif, serif" font-size="64" font-weight="700">${escapeXml(READS_OFFER_HEADLINE_LINES[0])}</text>
  <text x="72" y="376" fill="#ffffff" font-family="Liberation Serif, DejaVu Serif, serif" font-size="64" font-weight="700">${escapeXml(READS_OFFER_HEADLINE_LINES[1])}</text>
  <text x="72" y="452" fill="#ffffff" font-family="Liberation Serif, DejaVu Serif, serif" font-size="64" font-weight="700">${escapeXml(READS_OFFER_HEADLINE_LINES[2])}</text>
  <text x="72" y="516" fill="#ffffff" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="24">${escapeXml(ownOrReadLine().split(', ')[0])},</text>
  <text x="72" y="550" fill="#ffffff" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="24">${escapeXml(ownOrReadLine().split(', ')[1] ?? '')}.</text>
</svg>`);
  let image = sharp(board);
  const composites = thumbs.map((input, index) => ({ input, left: 760 + (index % 2) * 188, top: 70 + Math.floor(index / 2) * 270 }));
  image = image.composite(composites);
  return image.jpeg({ quality: 82 }).toBuffer();
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function frameShot(file: string, width: number, height: number, screen: { x: number; y: number; w: number; h: number; rx: number }, chrome: Buffer) {
  const shot = await sharp(file).resize(screen.w, screen.h, { fit: 'cover', position: 'top' }).png().toBuffer();
  const mask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${screen.w}" height="${screen.h}">
  <rect width="${screen.w}" height="${screen.h}" rx="${screen.rx}" fill="#fff"/>
</svg>`);
  const rounded = await sharp(shot).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: { r: 244, g: 246, b: 246, alpha: 1 } },
  }).composite([
    { input: chrome, left: 0, top: 0 },
    { input: rounded, left: screen.x, top: screen.y },
  ]).png().toBuffer();
}

function phoneChrome(): Buffer {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_WIDTH}" height="${PHONE_HEIGHT}">
  <rect x="8" y="8" width="${PHONE_WIDTH - 16}" height="${PHONE_HEIGHT - 16}" rx="64" fill="${light.ink}"/>
  <rect x="28" y="24" width="${PHONE_WIDTH - 56}" height="${PHONE_HEIGHT - 48}" rx="40" fill="#0e171b"/>
  <rect x="${PHONE_WIDTH / 2 - 48}" y="36" width="96" height="18" rx="9" fill="${light.ink}"/>
</svg>`);
}

function tabletChrome(): Buffer {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TABLET_WIDTH}" height="${TABLET_HEIGHT}">
  <rect x="8" y="8" width="${TABLET_WIDTH - 16}" height="${TABLET_HEIGHT - 16}" rx="40" fill="${light.ink}"/>
  <rect x="28" y="28" width="${TABLET_WIDTH - 56}" height="${TABLET_HEIGHT - 56}" rx="16" fill="#0e171b"/>
</svg>`);
}

function laptopChrome(): Buffer {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LAPTOP_WIDTH}" height="${LAPTOP_HEIGHT}">
  <rect x="70" y="24" width="1460" height="860" rx="22" fill="${light.ink}"/>
  <rect x="90" y="44" width="1420" height="820" rx="8" fill="#0e171b"/>
  <path d="M20 900 h1560 l-70 90 h-1420 z" fill="#1a2a30"/>
  <rect x="620" y="918" width="360" height="10" rx="5" fill="#3e5257"/>
</svg>`);
}

async function devices() {
  const phone = path.join(SHOTS, 'phone-shelf.png');
  const tablet = path.join(SHOTS, 'tablet-reader.png');
  const laptop = path.join(SHOTS, 'laptop-ask.png');
  if (!(await exists(phone)) || !(await exists(tablet)) || !(await exists(laptop))) {
    console.log('Device screenshots not found in /tmp/reads-shots. Skipping frames.');
    return;
  }
  const phoneStill = await frameShot(phone, PHONE_WIDTH, PHONE_HEIGHT, {
    x: 36, y: 58, w: PHONE_WIDTH - 72, h: PHONE_HEIGHT - 96, rx: 28,
  }, phoneChrome());
  const tabletStill = await frameShot(tablet, TABLET_WIDTH, TABLET_HEIGHT, {
    x: 36, y: 36, w: TABLET_WIDTH - 72, h: TABLET_HEIGHT - 72, rx: 12,
  }, tabletChrome());
  const laptopStill = await frameShot(laptop, LAPTOP_WIDTH, LAPTOP_HEIGHT, {
    x: 98, y: 52, w: 1404, h: 804, rx: 6,
  }, laptopChrome());
  await mkdir(path.join(ROOT, 'devices'), { recursive: true });
  await writeStill(phoneStill, path.join(ROOT, 'devices/phone-shelf.webp'), PHONE_WIDTH, PHONE_HEIGHT);
  await writeStill(tabletStill, path.join(ROOT, 'devices/tablet-reader.webp'), TABLET_WIDTH, TABLET_HEIGHT);
  await writeStill(laptopStill, path.join(ROOT, 'devices/laptop-ask.webp'), LAPTOP_WIDTH, LAPTOP_HEIGHT);
  console.log('Device frames written.');
}

async function main() {
  if (process.argv.includes('--og-only')) {
    const covers = await Promise.all(ORDER.slice(0, 4).map(id => sharp(path.join(ROOT, 'covers', `${id}.webp`)).png().toBuffer()));
    const poster = await og(covers);
    await sharp(poster).jpeg({ quality: 82 }).toFile(path.join(ROOT, 'og.jpg'));
    console.log('OG written.');
    return;
  }
  await mkdir(path.join(ROOT, 'covers'), { recursive: true });
  await mkdir(path.join(ROOT, 'mockups'), { recursive: true });
  const covers: Buffer[] = [];
  for (const id of ORDER) {
    const cover = await renderCover(id);
    covers.push(cover);
    await writeStill(cover, path.join(ROOT, 'covers', `${id}.webp`), COVER_WIDTH, COVER_HEIGHT);
    console.log('cover', id);
  }
  const cells = covers[ORDER.indexOf('cells-to-systems')];
  const harbour = covers[ORDER.indexOf('harbour-light')];
  const contract = covers[ORDER.indexOf('plain-contract')];
  const yellow = covers[ORDER.indexOf('yellow-window')];
  await writeStill(await physicalBook(cells), path.join(ROOT, 'mockups/book-cells.webp'), BOOK_3D_WIDTH, BOOK_3D_HEIGHT);
  await writeStill(await physicalBook(harbour), path.join(ROOT, 'mockups/book-harbour.webp'), BOOK_3D_WIDTH, BOOK_3D_HEIGHT);
  await writeStill(await ebook(contract, 'Ebook · Plain Words for Contract'), path.join(ROOT, 'mockups/ebook-contract.webp'), EBOOK_WIDTH, EBOOK_HEIGHT);
  await writeStill(await ebook(yellow, 'Ebook · The yellow window'), path.join(ROOT, 'mockups/ebook-yellow.webp'), EBOOK_WIDTH, EBOOK_HEIGHT);
  await writeStill(await fan(covers), path.join(ROOT, 'mockups/fan.webp'), FAN_WIDTH, FAN_HEIGHT);
  const poster = await og(covers);
  await sharp(poster).jpeg({ quality: 82 }).toFile(path.join(ROOT, 'og.jpg'));
  console.log('Covers, books and OG written.');
  await devices();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
