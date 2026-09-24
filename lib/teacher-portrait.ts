/**
 * Illustrated portraits for the AI teachers.
 *
 * Generated as inline SVG data URIs rather than fetched from an avatar
 * service: the cards then never wait on a third party, never show a broken
 * tile, and render identically offline. Each portrait is deterministic, so a
 * teacher always looks the same.
 *
 * Each is a full-bleed scene — backdrop, figure and a subject motif — sized to
 * fill the card's image pane rather than a small avatar tile floating in it.
 */

import type { AiTeacher, TeacherIconKey } from './ai-teachers';

/** Skin, hair and clothing sets, picked deterministically per teacher. */
const SKIN = ['#F2C9A0', '#E0A87C', '#C68642', '#8D5524', '#FADCBC', '#A9714B'];
const HAIR = ['#2B1B12', '#4A2C1A', '#6B4423', '#1A1A1A', '#8B5A2B', '#3D2314'];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return Math.abs(h);
}

/** Subject motif drawn behind the figure. */
function motif(key: TeacherIconKey): string {
  switch (key) {
    case 'atom':
      return `<g stroke="#fff" stroke-width="2.5" fill="none" opacity=".5">
        <ellipse cx="0" cy="0" rx="34" ry="13"/>
        <ellipse cx="0" cy="0" rx="34" ry="13" transform="rotate(60)"/>
        <ellipse cx="0" cy="0" rx="34" ry="13" transform="rotate(120)"/>
        <circle cx="0" cy="0" r="5" fill="#fff" stroke="none"/></g>`;
    case 'calculator':
      return `<g opacity=".5" fill="#fff" font-family="system-ui,sans-serif" font-weight="700">
        <text x="-30" y="-6" font-size="26">∑</text>
        <text x="4" y="-6" font-size="26">π</text>
        <text x="-30" y="26" font-size="26">√</text>
        <text x="6" y="26" font-size="26">∞</text></g>`;
    case 'pen':
      return `<g opacity=".5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
        <path d="M-26 22 L14 -18 L24 -8 L-16 32 Z"/><path d="M-26 22 L-30 36 L-16 32"/>
        <path d="M-28 -18h30M-28 -8h18"/></g>`;
    case 'globe':
      return `<g opacity=".5" fill="none" stroke="#fff" stroke-width="2.5">
        <circle cx="0" cy="0" r="30"/><ellipse cx="0" cy="0" rx="13" ry="30"/>
        <path d="M-30 0h60M-26 -15h52M-26 15h52"/></g>`;
    case 'languages':
      return `<g opacity=".5" fill="#fff" font-family="system-ui,sans-serif" font-weight="700">
        <text x="-32" y="4" font-size="30">A</text><text x="-6" y="4" font-size="30">文</text>
        <text x="-14" y="32" font-size="22">あ</text></g>`;
    case 'code':
      return `<g opacity=".5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-14 -16 L-32 2 L-14 20"/><path d="M14 -16 L32 2 L14 20"/><path d="M4 -22 L-4 26"/></g>`;
    default:
      return `<g opacity=".5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round">
        <path d="M-30 -18 L0 -8 L30 -18 L30 16 L0 26 L-30 16 Z"/><path d="M0 -8 V26"/></g>`;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * A portrait for one teacher, as a `data:image/svg+xml` URI usable directly in
 * an `<img src>`. Sized 2:1 to fill a card's image pane.
 */
export function teacherPortrait(
  teacher: Pick<AiTeacher, 'id' | 'name' | 'accentColor' | 'iconKey'>,
): string {
  const h = hash(teacher.id);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const accent = teacher.accentColor;
  // Long hair on some, short on others — enough variation that nine teachers
  // do not read as one person recoloured.
  const longHair = ((h >> 7) & 1) === 1;
  const glasses = ((h >> 9) & 1) === 1;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="220" viewBox="0 0 440 220" role="img" aria-label="${esc(teacher.name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent}bb"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="26%" r="62%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".34"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="frame"><rect width="440" height="220"/></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="440" height="220" fill="url(#bg)"/>
    <rect width="440" height="220" fill="url(#glow)"/>

    <!-- subject motif, offset from the figure -->
    <g transform="translate(348 74)">${motif(teacher.iconKey)}</g>
    <circle cx="74" cy="176" r="46" fill="#fff" opacity=".08"/>

    <!-- figure, seated low so the face sits on the upper third -->
    <g transform="translate(150 34)">
      <!-- shoulders -->
      <path d="M-66 186 Q-66 118 0 118 Q66 118 66 186 Z" fill="#ffffff" opacity=".95"/>
      <path d="M-20 118 Q0 140 20 118 L20 128 Q0 150 -20 128 Z" fill="${accent}" opacity=".25"/>
      <!-- neck -->
      <rect x="-13" y="96" width="26" height="30" rx="12" fill="${skin}"/>
      ${longHair ? `<path d="M-52 62 Q-52 128 -40 150 L-28 150 Q-40 120 -40 74 Z" fill="${hair}"/>
      <path d="M52 62 Q52 128 40 150 L28 150 Q40 120 40 74 Z" fill="${hair}"/>` : ''}
      <!-- head -->
      <ellipse cx="0" cy="58" rx="43" ry="49" fill="${skin}"/>
      <!-- hair -->
      <path d="M-44 52 Q-42 4 0 4 Q42 4 44 52 Q36 26 0 26 Q-34 26 -44 52 Z" fill="${hair}"/>
      <!-- ears -->
      <ellipse cx="-43" cy="60" rx="7" ry="10" fill="${skin}"/>
      <ellipse cx="43" cy="60" rx="7" ry="10" fill="${skin}"/>
      <!-- eyes -->
      <ellipse cx="-15" cy="58" rx="4.6" ry="5.4" fill="#22303a"/>
      <ellipse cx="15" cy="58" rx="4.6" ry="5.4" fill="#22303a"/>
      <circle cx="-13.4" cy="56" r="1.6" fill="#fff"/>
      <circle cx="16.6" cy="56" r="1.6" fill="#fff"/>
      <!-- brows -->
      <path d="M-24 46 Q-15 42 -7 46" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M7 46 Q15 42 24 46" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${glasses ? `<g fill="none" stroke="#22303a" stroke-width="2.4" opacity=".85">
        <rect x="-27" y="49" width="24" height="19" rx="9"/>
        <rect x="3" y="49" width="24" height="19" rx="9"/>
        <path d="M-3 58h6M-27 56l-9-3M27 56l9-3"/></g>` : ''}
      <!-- smile -->
      <path d="M-11 79 Q0 89 11 79" stroke="#a9614b" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n\s*/g, ' '))}`;
}
