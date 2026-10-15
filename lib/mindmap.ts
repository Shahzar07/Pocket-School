/**
 * Tony Buzan mind maps: one keyword on a thick, curved, tapering branch,
 * a distinct colour per main branch, thinner sub-branches, and a small icon.
 * The model returns JSON. This module lays that JSON out for an SVG.
 */

export const BUZAN_COLORS = [
  '#E23B3B',
  '#F0A202',
  '#2F9E44',
  '#1C7ED6',
  '#7048E8',
  '#E8590C',
  '#0CA678',
  '#D6336C',
] as const;

export interface BuzanNode {
  keyword: string;
  icon: string;
  children: BuzanNode[];
}

export interface BuzanMap {
  center: string;
  centerIcon: string;
  branches: BuzanNode[];
}

export interface BuzanRibbon {
  path: string;
  color: string;
  keyword: string;
  icon: string;
  depth: number;
  startWidth: number;
  endWidth: number;
  labelX: number;
  labelY: number;
  iconX: number;
  iconY: number;
  curved: boolean;
}

export interface BuzanLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  center: string;
  centerIcon: string;
  ribbons: BuzanRibbon[];
}

const ICONS = ['💡', '📌', '⭐', '🔑', '📘', '🌱', '⚙️', '🎯', '💬', '📈'];

export function oneKeyword(value: string): string {
  const cleaned = value.replace(/[*#`_]/g, ' ').replace(/[^\p{L}\p{N}-]+/gu, ' ').trim();
  const word = cleaned.split(/\s+/).filter(Boolean)[0] ?? 'Topic';
  return word.slice(0, 18);
}

function iconFor(keyword: string, given?: string): string {
  const trimmed = (given ?? '').trim();
  if (trimmed) return [...trimmed][0] ?? ICONS[0];
  const code = [...keyword].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return ICONS[code % ICONS.length];
}

function asNode(value: unknown, depth: number): BuzanNode | null {
  if (depth > 2 || value == null) return null;
  if (typeof value === 'string') {
    const keyword = oneKeyword(value);
    return keyword ? { keyword, icon: iconFor(keyword), children: [] } : null;
  }
  if (typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const raw = record.keyword ?? record.label ?? record.text ?? record.name;
  if (typeof raw !== 'string') return null;
  const keyword = oneKeyword(raw);
  const kids = Array.isArray(record.children) ? record.children : [];
  return {
    keyword,
    icon: iconFor(keyword, typeof record.icon === 'string' ? record.icon : undefined),
    children: kids.map(child => asNode(child, depth + 1)).filter((child): child is BuzanNode => !!child).slice(0, 5),
  };
}

function extractObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Study-note headings are not a mind map. */
export function isStudyNoteProse(text: string): boolean {
  return /##\s*introduction/i.test(text) && /##\s*core explanation/i.test(text);
}

export function parseBuzan(raw: string): BuzanMap | null {
  const text = raw.trim();
  if (!text || isStudyNoteProse(text)) return null;
  const record = extractObject(text);
  if (!record) return buzanFromMarkdown(text);
  const centerRaw = record.center ?? record.topic ?? record.title;
  const center = typeof centerRaw === 'string' ? oneKeyword(centerRaw) : '';
  const branches = (Array.isArray(record.branches) ? record.branches : [])
    .map(branch => asNode(branch, 0))
    .filter((branch): branch is BuzanNode => !!branch)
    .slice(0, 8);
  if (!center || branches.length < 2) return null;
  if (branches.some(branch => branch.keyword.toLowerCase() === 'introduction')) return null;
  return {
    center,
    centerIcon: iconFor(center, typeof record.centerIcon === 'string' ? record.centerIcon : undefined),
    branches,
  };
}

function buzanFromMarkdown(md: string): BuzanMap | null {
  if (isStudyNoteProse(md)) return null;
  const lines = md.split('\n').map(line => line.trim()).filter(Boolean);
  let center = '';
  const branches: BuzanNode[] = [];
  let current: BuzanNode | null = null;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)/);
    if (heading) {
      const keyword = oneKeyword(heading[1]);
      if (!center) center = keyword;
      else {
        current = { keyword, icon: iconFor(keyword), children: [] };
        branches.push(current);
      }
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)/);
    if (bullet && current && current.children.length < 5) {
      const keyword = oneKeyword(bullet[1]);
      current.children.push({ keyword, icon: iconFor(keyword), children: [] });
    }
  }
  if (!center || branches.length < 2) return null;
  return { center, centerIcon: iconFor(center), branches };
}

interface Point { x: number; y: number }

function quadPoint(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

function quadTangent(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: 2 * u * (c.x - p0.x) + 2 * t * (p1.x - c.x),
    y: 2 * u * (c.y - p0.y) + 2 * t * (p1.y - c.y),
  };
}

function xmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ribbon(p0: Point, c: Point, p1: Point, startWidth: number, endWidth: number): string {
  const steps = 14;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = quadPoint(p0, c, p1, t);
    const tangent = quadTangent(p0, c, p1, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const nx = -tangent.y / length;
    const ny = tangent.x / length;
    const half = (startWidth + (endWidth - startWidth) * t) / 2;
    left.push({ x: point.x + nx * half, y: point.y + ny * half });
    right.push({ x: point.x - nx * half, y: point.y - ny * half });
  }
  const points = [...left, ...right.reverse()];
  return `M ${points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} Z`;
}

function bendOf(origin: Point, end: Point, amount: number): Point {
  const mid = { x: (origin.x + end.x) / 2, y: (origin.y + end.y) / 2 };
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: mid.x + (-dy / length) * amount, y: mid.y + (dx / length) * amount };
}

const WIDTHS = [
  { start: 26, end: 10 },
  { start: 12, end: 4 },
  { start: 6, end: 2 },
];

export function layoutBuzan(map: BuzanMap): BuzanLayout {
  const width = 1600;
  const height = 1100;
  const centerX = width / 2;
  const centerY = height / 2;
  const ribbons: BuzanRibbon[] = [];

  const walk = (node: BuzanNode, origin: Point, angle: number, length: number, depth: number, color: string) => {
    const end = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
    const control = bendOf(origin, end, depth === 0 ? 42 : 24);
    const widths = WIDTHS[Math.min(depth, WIDTHS.length - 1)];
    const mid = quadPoint(origin, control, end, 0.55);
    ribbons.push({
      path: ribbon(origin, control, end, widths.start, widths.end),
      color,
      keyword: node.keyword,
      icon: node.icon,
      depth,
      startWidth: widths.start,
      endWidth: widths.end,
      labelX: end.x,
      labelY: end.y,
      iconX: mid.x,
      iconY: mid.y,
      curved: Math.hypot(control.x - (origin.x + end.x) / 2, control.y - (origin.y + end.y) / 2) > 8,
    });
    const kids = node.children;
    const spread = 0.8;
    kids.forEach((child, index) => {
      const offset = kids.length === 1 ? 0 : -spread / 2 + (spread * index) / (kids.length - 1);
      walk(child, end, angle + offset, length * 0.58, depth + 1, color);
    });
  };

  map.branches.forEach((branch, index) => {
    const angle = -Math.PI / 2 + (index / map.branches.length) * Math.PI * 2;
    walk(branch, { x: centerX, y: centerY }, angle, 210, 0, BUZAN_COLORS[index % BUZAN_COLORS.length]);
  });

  return {
    width,
    height,
    centerX,
    centerY,
    center: map.center,
    centerIcon: map.centerIcon,
    ribbons,
  };
}

export function mindmapSvg(map: BuzanMap): string {
  const layout = layoutBuzan(map);
  const branches = layout.ribbons.map(ribbon => `
    <path d="${ribbon.path}" fill="${ribbon.color}" />
    <text x="${ribbon.iconX.toFixed(1)}" y="${ribbon.iconY.toFixed(1)}" font-size="16" text-anchor="middle">${xmlText(ribbon.icon)}</text>
    <text x="${ribbon.labelX.toFixed(1)}" y="${ribbon.labelY.toFixed(1)}" font-size="${ribbon.depth === 0 ? 16 : 13}" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#1f2933">${xmlText(ribbon.keyword)}</text>
  `).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
  <rect width="100%" height="100%" fill="#f7f4ee" />
  ${branches}
  <circle cx="${layout.centerX}" cy="${layout.centerY}" r="62" fill="#243037" />
  <text x="${layout.centerX}" y="${layout.centerY - 6}" font-size="20" text-anchor="middle">${xmlText(layout.centerIcon)}</text>
  <text x="${layout.centerX}" y="${layout.centerY + 18}" font-size="14" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#ffffff">${xmlText(layout.center)}</text>
</svg>`;
}
