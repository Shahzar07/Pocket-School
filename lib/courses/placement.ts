/**
 * Featured placement: who may rotate, in what order, and how duplicates are told apart.
 * Pure. Dates are passed in so a query never calls the clock.
 */

import { AI_TEACHERS } from '@/lib/ai-teachers';
import { portraitFor } from '@/lib/teacher-portrait';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const YEAR = /\b(?:year|yr)\s*(\d{1,2})\b/i;

export type FeaturedKind = 'course' | 'bundle' | 'book';
export type ProgrammePlan = 'primary_secondary' | 'igcse_alevel' | 'professional';

export interface FeaturedSlide {
  id: string;
  sourceId: string;
  kind: FeaturedKind;
  title: string;
  level: string;
  subject: string;
  cover: string;
  priceLabel: string;
  rating: number | null;
  ratingCount: number;
  teacherId: string;
  teacherName: string;
  teacherSrc: string;
  href: string;
  buyHref: string;
  enrolHref: string;
  priority: number;
  from: string;
  until: string;
  eligible: boolean;
}

export interface PlacementCourse {
  id: string;
  title: string;
  status: string;
  type?: string;
  level?: string;
  subject?: string;
  price?: number;
  currency?: string;
  thumbnailUrl?: string;
  ownerId: string;
  ownerName?: string;
  ratingAverage?: number;
  ratingCount?: number;
  marketplaceApproved?: boolean;
  featured?: boolean;
  placement?: {
    marketplace?: string;
    featured?: boolean;
    core?: boolean;
    levels?: string[];
    institutionIds?: string[];
    priority?: number;
    featuredFrom?: string;
    featuredUntil?: string;
    mergedInto?: string;
  };
}

export interface PlacementBook {
  id: string;
  title: string;
  status: string;
  allocateMarketplace: boolean;
  priceUsd?: number;
  readingLevel?: string;
  cover?: string;
  featured: boolean;
  priority: number;
  featuredFrom?: string;
  featuredUntil?: string;
}

export function dedupeById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function courseLine(input: {
  ownerName?: string;
  ownerId: string;
  institutionName?: string;
  createdOn?: string;
  status: string;
}): string {
  return [input.ownerName || input.ownerId, input.institutionName, input.createdOn, input.status]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

export interface InstitutionChoice {
  id: string;
  name: string;
  domain: string;
  duplicateIds: string[];
}

export function institutionChoices(rows: readonly {
  id: string;
  name: string;
  domain?: string;
  createdAtMs?: number;
}[]): InstitutionChoice[] {
  const unique = dedupeById(rows);
  const parent = unique.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor] ?? cursor;
    return cursor;
  };
  const same = (a: (typeof unique)[number], b: (typeof unique)[number]) => {
    if (normaliseKey(a.name) !== normaliseKey(b.name) || !normaliseKey(a.name)) return false;
    const left = normaliseKey(a.domain ?? '');
    const right = normaliseKey(b.domain ?? '');
    return !left || !right || left === right;
  };
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const left = unique[i];
      const right = unique[j];
      if (!left || !right || !same(left, right)) continue;
      parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, typeof unique>();
  unique.forEach((row, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(row);
    groups.set(root, list);
  });
  const choices: InstitutionChoice[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (b.createdAtMs ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
    const keep = sorted[0];
    if (!keep) continue;
    choices.push({
      id: keep.id,
      name: keep.name,
      domain: keep.domain ?? '',
      duplicateIds: sorted.slice(1).map((row) => row.id),
    });
  }
  return choices.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Suggest a level name. The stored title is left untouched. */
export function yearTitleHint(title: string): string | null {
  const match = title.match(YEAR);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  const level = year >= 1 && year <= 6
    ? 'Primary'
    : year >= 7 && year <= 9
      ? 'Secondary'
      : year === 10 || year === 11
        ? 'IGCSE'
        : year === 12 || year === 13
          ? 'A-Level'
          : null;
  if (!level) return null;
  const token = match[0];
  const stripped = title
    .replace(new RegExp(`\\s*[—–-]\\s*${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
    .replace(new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—–-]?\\s*`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped ? `${stripped} — ${level}` : level;
}

export function duplicateTitleGroups<T extends { id: string; title: string }>(rows: readonly T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const row of dedupeById(rows)) {
    const key = normaliseKey(row.title);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.values()].filter((group) => group.length > 1);
}

export function mergePlan(keepId: string, dropId: string): {
  keepId: string;
  dropId: string;
  moveEnrolments: true;
  retargetGrades: true;
  deleteCourse: false;
} | { error: string } {
  if (!keepId || !dropId || keepId === dropId) return { error: 'Choose two different courses.' };
  return { keepId, dropId, moveEnrolments: true, retargetGrades: true, deleteCourse: false };
}

export function canFeature(marketplace: string): boolean {
  return marketplace === 'approved';
}

/** A public catalogue hides a course once an admin has set marketplace to anything but listed. */
export function catalogueListed(course: { placement?: { marketplace?: string } | null }): boolean {
  const market = course.placement?.marketplace;
  return !market || market === 'approved';
}

export function inFeaturedWindow(from: string | undefined, until: string | undefined, today: string): boolean {
  if (!DAY.test(today)) return false;
  if (from && DAY.test(from) && today < from) return false;
  if (until && DAY.test(until) && today > until) return false;
  return true;
}

export function moneyLabel(price?: number, currency?: string): string {
  if (typeof price !== 'number' || !(price > 0)) return '';
  const digits = Number.isInteger(price) ? 0 : 2;
  const amount = price.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  if (!currency || currency === 'USD') return `$${amount}`;
  return `${amount} ${currency}`;
}

export function realRating(average?: number, count?: number): { value: number; count: number } | null {
  if (typeof average !== 'number' || typeof count !== 'number') return null;
  if (!(count > 0) || average < 0 || average > 5) return null;
  return { value: Math.round(average * 10) / 10, count };
}

export function teacherForTopic(topic: string): { id: string; name: string; src: string } {
  const src = portraitFor(topic, topic);
  const id = src.replace(/^\/teachers\//, '').replace(/\.webp$/, '');
  const named = AI_TEACHERS.find((teacher) => teacher.id === id);
  return { id, name: named?.name ?? 'ET AI', src };
}

export function programmePlan(level: string): ProgrammePlan | null {
  const value = level.toLowerCase();
  if (!value.trim()) return null;
  if (/llb|mbbs|professional|degree|university|law|medicine/.test(value)) return 'professional';
  if (/igcse|gcse|a-level|a level|alevel/.test(value)) return 'igcse_alevel';
  if (/primary|secondary/.test(value)) return 'primary_secondary';
  return null;
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleStable<T>(items: readonly T[], seed: string): T[] {
  let state = hashSeed(seed) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = swap as T;
  }
  return copy;
}

/** Higher priority bands stay in front. Inside a band, order changes with the day and the session. */
export function orderFeatured(items: readonly FeaturedSlide[], today: string, sessionKey: string): FeaturedSlide[] {
  const live = items.filter((item) => item.eligible && inFeaturedWindow(item.from, item.until, today));
  const groups = new Map<number, FeaturedSlide[]>();
  for (const item of live) {
    const band = groups.get(item.priority) ?? [];
    band.push(item);
    groups.set(item.priority, band);
  }
  const priorities = [...groups.keys()].sort((a, b) => b - a);
  const ordered: FeaturedSlide[] = [];
  for (const priority of priorities) {
    const band = [...(groups.get(priority) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    ordered.push(...shuffleStable(band, `${today}|${sessionKey}|${priority}`));
  }
  return ordered;
}

export function courseSlide(course: PlacementCourse): FeaturedSlide {
  const marketplace = course.placement?.marketplace ?? (course.marketplaceApproved ? 'approved' : 'hidden');
  const featured = (course.placement?.featured ?? course.featured === true) && !course.placement?.mergedInto;
  const kind: FeaturedKind = course.type === 'bundle' ? 'bundle' : 'course';
  const teacher = teacherForTopic(course.subject || course.title);
  const rating = realRating(course.ratingAverage, course.ratingCount);
  return {
    id: `${kind}:${course.id}`,
    sourceId: course.id,
    kind,
    title: course.title,
    level: course.level ?? '',
    subject: course.subject ?? '',
    cover: course.thumbnailUrl ?? '',
    priceLabel: moneyLabel(course.price, course.currency),
    rating: rating?.value ?? null,
    ratingCount: rating?.count ?? 0,
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherSrc: teacher.src,
    href: `/courses/${course.id}`,
    buyHref: `/courses/${course.id}`,
    enrolHref: `/courses/${course.id}`,
    priority: course.placement?.priority ?? 0,
    from: course.placement?.featuredFrom ?? '',
    until: course.placement?.featuredUntil ?? '',
    eligible: marketplace === 'approved' && featured && course.status === 'published',
  };
}

export function bookSlide(book: PlacementBook): FeaturedSlide {
  const teacher = teacherForTopic(book.readingLevel || book.title);
  const rating = realRating(undefined, undefined);
  return {
    id: `book:${book.id}`,
    sourceId: book.id,
    kind: 'book',
    title: book.title,
    level: book.readingLevel ?? '',
    subject: '',
    cover: book.cover ?? '',
    priceLabel: moneyLabel(book.priceUsd, 'USD'),
    rating: rating?.value ?? null,
    ratingCount: 0,
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherSrc: teacher.src,
    href: `/reads/book/${book.id}`,
    buyHref: `/reads/book/${book.id}`,
    enrolHref: `/reads/read/${book.id}`,
    priority: book.priority,
    from: book.featuredFrom ?? '',
    until: book.featuredUntil ?? '',
    eligible: book.featured && book.status === 'published' && book.allocateMarketplace,
  };
}

export function previewSlide(input: {
  id: string;
  title: string;
  level: string;
  subject: string;
  price?: number;
  currency?: string;
  cover: string;
  kind: FeaturedKind;
  priority: number;
  from: string;
  until: string;
}): FeaturedSlide {
  const teacher = teacherForTopic(input.subject || input.title);
  const book = input.kind === 'book';
  return {
    id: `${input.kind}:${input.id}`,
    sourceId: input.id,
    kind: input.kind,
    title: input.title,
    level: input.level,
    subject: input.subject,
    cover: input.cover,
    priceLabel: moneyLabel(input.price, input.currency),
    rating: null,
    ratingCount: 0,
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherSrc: teacher.src,
    href: book ? `/reads/book/${input.id}` : `/courses/${input.id}`,
    buyHref: book ? `/reads/book/${input.id}` : `/courses/${input.id}`,
    enrolHref: book ? `/reads/read/${input.id}` : `/courses/${input.id}`,
    priority: input.priority,
    from: input.from,
    until: input.until,
    eligible: true,
  };
}
