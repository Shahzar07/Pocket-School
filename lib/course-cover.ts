/**
 * Deterministic course cover images.
 *
 * Generated as inline SVG data URIs rather than fetched from a stock-photo
 * host: covers then never 404, never need a licence, cost no extra request,
 * and render identically offline. The same title always produces the same
 * cover, so a course's artwork doesn't change between page loads.
 */

/** Palette pairs — each is a readable gradient with white text on top. */
const GRADIENTS: [string, string][] = [
  ['#f59e0b', '#b45309'], // amber
  ['#0ea5e9', '#1e3a8a'], // sky → indigo
  ['#10b981', '#065f46'], // emerald
  ['#8b5cf6', '#4c1d95'], // violet
  ['#ef4444', '#7f1d1d'], // red
  ['#ec4899', '#831843'], // pink
  ['#14b8a6', '#134e4a'], // teal
  ['#6366f1', '#312e81'], // indigo
];

/**
 * Stable hash — same input, same cover, every time.
 *
 * FNV-1a alone clumps badly on similar strings (course titles share long
 * prefixes), which put adjacent catalogue entries on the same gradient. The
 * final avalanche mixes the low bits so neighbouring titles spread out.
 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return Math.abs(h);
}

/** XML-escape text going into the SVG so a quote in a title can't break it. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Up to two initials from the subject, e.g. "Additional Mathematics" → "AM". */
function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '📘';
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export interface CourseCoverOptions {
  width?: number;
  height?: number;
  /**
   * Force a specific palette instead of deriving one from the title. Used by
   * the shipped catalogue so its five covers are guaranteed distinct — with
   * eight palettes, hashing five titles collides more often than not, and two
   * adjacent cards in the same colour reads as a bug rather than a choice.
   */
  paletteIndex?: number;
}

export const COVER_PALETTE_COUNT = GRADIENTS.length;

/**
 * A cover image for a course, as a `data:image/svg+xml` URI usable directly in
 * an <img src> or a CSS background.
 */
export function courseCover(
  title: string,
  subject = '',
  { width = 800, height = 450, paletteIndex }: CourseCoverOptions = {},
): string {
  const key = `${title}|${subject}`;
  const slot = paletteIndex === undefined
    ? hash(key) % GRADIENTS.length
    // Modulo keeps an out-of-range index safe rather than yielding undefined.
    : ((paletteIndex % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length;
  const [from, to] = GRADIENTS[slot];
  const label = initials(subject || title);
  // Offset the decorative circles per course so no two covers look alike.
  const cx = 60 + (hash(key + 'x') % 30);
  const cy = 20 + (hash(key + 'y') % 40);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 800 450" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <circle cx="${cx * 8}" cy="${cy * 8}" r="200" fill="#ffffff" opacity="0.10"/>
  <circle cx="${800 - cx * 6}" cy="${450 - cy * 4}" r="130" fill="#ffffff" opacity="0.08"/>
  <text x="64" y="250" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
        font-size="150" font-weight="800" fill="#ffffff" opacity="0.92">${esc(label)}</text>
  <text x="66" y="320" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
        font-size="30" font-weight="600" fill="#ffffff" opacity="0.85">${esc(subject || 'Course')}</text>
</svg>`;

  // encodeURIComponent rather than base64 — smaller, and readable in devtools.
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n\s*/g, ' '))}`;
}
