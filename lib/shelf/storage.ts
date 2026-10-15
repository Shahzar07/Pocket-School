'use client';

export type ProfileKind = 'reader' | 'child' | 'parent';

export interface ShelfProfile {
  id: string;
  name: string;
  kind: ProfileKind;
  /** Books with a higher age rating are hidden. */
  maxAge: number | null;
  tint: string;
}

export const SHELF_PROFILES: ShelfProfile[] = [
  { id: 'aisha', name: 'Aisha', kind: 'reader', maxAge: null, tint: '#2786A4' },
  { id: 'imran', name: 'Imran', kind: 'child', maxAge: 8, tint: '#E2AF4D' },
  { id: 'family', name: 'Family', kind: 'parent', maxAge: null, tint: '#3E555C' },
];

const PROFILE_KEY = 'poket-shelf-profile';
const SEEDED = 'poket-shelf-demo-seeded';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function currentProfile(): ShelfProfile {
  const id = typeof window === 'undefined' ? 'aisha' : window.localStorage.getItem(PROFILE_KEY) || 'aisha';
  return SHELF_PROFILES.find(p => p.id === id) ?? SHELF_PROFILES[0];
}

export function setCurrentProfile(id: string) {
  window.localStorage.setItem(PROFILE_KEY, id);
}

export interface StoredProgress {
  chapterIndex: number;
  pageIndex: number;
  percent: number;
  updatedAt: number;
}

export function progressMap(profileId: string): Record<string, StoredProgress> {
  return readJson(`poket-progress:${profileId}`, {});
}

export function saveProgress(profileId: string, itemId: string, progress: StoredProgress) {
  const all = progressMap(profileId);
  all[itemId] = progress;
  writeJson(`poket-progress:${profileId}`, all);
}

export function myList(profileId: string): string[] {
  return readJson(`poket-list:${profileId}`, []);
}

export function toggleList(profileId: string, itemId: string): string[] {
  const list = myList(profileId);
  const next = list.includes(itemId) ? list.filter(id => id !== itemId) : [itemId, ...list];
  writeJson(`poket-list:${profileId}`, next);
  return next;
}

export interface ReaderPrefs {
  theme: 'light' | 'sepia' | 'dark';
  font: number;
  spacing: number;
  dyslexia: boolean;
  lang?: string;
}

export function readerPrefs(): ReaderPrefs {
  return readJson('poket-reader-prefs', { theme: 'sepia', font: 19, spacing: 1.75, dyslexia: false });
}

export function saveReaderPrefs(prefs: ReaderPrefs) {
  writeJson('poket-reader-prefs', prefs);
}

export interface NoteRecord {
  id: string;
  bookId: string;
  chapterIndex: number;
  quote: string;
  note: string;
  at: number;
}

export function notesFor(profileId: string, bookId: string): NoteRecord[] {
  const all = readJson<NoteRecord[]>(`poket-notes:${profileId}`, []);
  return all.filter(n => n.bookId === bookId);
}

export function addNote(profileId: string, note: NoteRecord) {
  const all = readJson<NoteRecord[]>(`poket-notes:${profileId}`, []);
  writeJson(`poket-notes:${profileId}`, [note, ...all].slice(0, 80));
}

export interface BookmarkRecord {
  bookId: string;
  chapterIndex: number;
  pageIndex: number;
}

export function bookmarks(profileId: string, bookId: string): BookmarkRecord[] {
  return readJson<BookmarkRecord[]>(`poket-bookmarks:${profileId}`, []).filter(b => b.bookId === bookId);
}

export function toggleBookmark(profileId: string, mark: BookmarkRecord): BookmarkRecord[] {
  const all = readJson<BookmarkRecord[]>(`poket-bookmarks:${profileId}`, []);
  const exists = all.some(b => b.bookId === mark.bookId && b.chapterIndex === mark.chapterIndex && b.pageIndex === mark.pageIndex);
  const next = exists
    ? all.filter(b => !(b.bookId === mark.bookId && b.chapterIndex === mark.chapterIndex && b.pageIndex === mark.pageIndex))
    : [mark, ...all];
  writeJson(`poket-bookmarks:${profileId}`, next);
  return next.filter(b => b.bookId === mark.bookId);
}

export interface SessionRecord {
  profileId: string;
  bookId: string;
  day: string;
  seconds: number;
  counted: boolean;
}

export function sessions(profileId: string): SessionRecord[] {
  return readJson(`poket-sessions:${profileId}`, []);
}

export function addSessionSeconds(profileId: string, bookId: string, seconds: number, counted: boolean) {
  const day = new Date().toISOString().slice(0, 10);
  const all = sessions(profileId);
  const found = all.find(s => s.day === day && s.bookId === bookId && s.counted === counted);
  if (found) found.seconds += seconds;
  else all.push({ profileId, bookId, day, seconds, counted });
  writeJson(`poket-sessions:${profileId}`, all);
}

export function minutesToday(profileId: string): number {
  const day = new Date().toISOString().slice(0, 10);
  return Math.round(sessions(profileId).filter(s => s.day === day).reduce((n, s) => n + s.seconds, 0) / 60);
}

export function streakDays(profileId: string): number {
  const days = new Set(sessions(profileId).filter(s => s.counted && s.seconds >= 60).map(s => s.day));
  let count = 0;
  const cursor = new Date();
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) {
      if (i === 0) { cursor.setDate(cursor.getDate() - 1); continue; }
      break;
    }
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function childHidden(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem('poket-hide-hafiz') === '1';
}

export function setChildHidden(hidden: boolean) {
  window.localStorage.setItem('poket-hide-hafiz', hidden ? '1' : '0');
}

function dayOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** First-visit sample shelf. Never overwrites a choice the reader already made. */
export function ensureDemoShelf() {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(SEEDED)) return;
  window.localStorage.setItem(SEEDED, '1');
  if (!window.localStorage.getItem(PROFILE_KEY)) {
    window.localStorage.setItem(PROFILE_KEY, 'aisha');
  }
  writeJson('poket-progress:aisha', {
    'harbour-light': { chapterIndex: 1, pageIndex: 0, percent: 46, updatedAt: Date.now() },
    'cells-to-systems': { chapterIndex: 0, pageIndex: 0, percent: 18, updatedAt: Date.now() - 86400000 },
    'seed:igcse-biology-cells-to-systems': { chapterIndex: 0, pageIndex: 0, percent: 35, updatedAt: Date.now() },
  });
  writeJson('poket-list:aisha', ['malacca', 'seed:english-essay-writing-mastery']);
  writeJson('poket-notes:aisha', [{
    id: 'n1',
    bookId: 'harbour-light',
    chapterIndex: 0,
    quote: 'Someone still climbed the stair.',
    note: 'Who is keeping the lamp?',
    at: Date.now(),
  }]);
  const today = dayOffset(0);
  writeJson('poket-sessions:aisha', [
    { profileId: 'aisha', bookId: 'harbour-light', day: today, seconds: 12 * 60, counted: true },
    { profileId: 'aisha', bookId: 'harbour-light', day: dayOffset(1), seconds: 20 * 60, counted: true },
    { profileId: 'aisha', bookId: 'cells-to-systems', day: dayOffset(2), seconds: 15 * 60, counted: true },
    { profileId: 'aisha', bookId: 'harbour-light', day: dayOffset(3), seconds: 10 * 60, counted: true },
  ]);
  writeJson('poket-sessions:imran', [
    { profileId: 'imran', bookId: 'blue-notebook', day: today, seconds: 8 * 60, counted: true },
    { profileId: 'imran', bookId: 'blue-notebook', day: dayOffset(1), seconds: 11 * 60, counted: true },
  ]);
}
