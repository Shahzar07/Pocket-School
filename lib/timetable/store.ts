import { blankTimetable, isInventedTimetable, personalTimetable, schoolTimetable } from './seed';
import type { TimetableFeed } from './publish';
import type { TimetableDoc } from './types';

const KEY = 'poket-timetable-v1';
const FEED = 'poket-timetable-feed';

interface Bundle {
  school: TimetableDoc;
  personal: TimetableDoc;
}

export interface BundleOptions {
  /** Preview and demo routes keep the labelled sample week. */
  sample?: boolean;
  ownerId?: string | null;
  institutionId?: string | null;
}

function fresh(options: BundleOptions = {}): Bundle {
  if (options.sample) {
    return { school: schoolTimetable(), personal: personalTimetable(options.ownerId || 't-adeyemi') };
  }
  const ownerId = options.ownerId || '';
  const institutionId = options.institutionId || '';
  return {
    school: blankTimetable('school', ownerId, institutionId),
    personal: blankTimetable('personal', ownerId, institutionId),
  };
}

function keep(doc: TimetableDoc | undefined, fallback: TimetableDoc, sample: boolean): TimetableDoc {
  if (!doc?.id) return fallback;
  const invented = isInventedTimetable(doc);
  if (sample) return invented ? doc : fallback;
  return invented ? fallback : doc;
}

export function loadBundle(options: BundleOptions = {}): Bundle {
  const base = fresh(options);
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Bundle>;
    return {
      school: keep(parsed.school, base.school, options.sample === true),
      personal: keep(parsed.personal, base.personal, options.sample === true),
    };
  } catch {
    return base;
  }
}

export function saveBundle(bundle: Bundle): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(bundle));
}

export function saveDoc(doc: TimetableDoc, options: BundleOptions = {}): Bundle {
  const bundle = loadBundle({ ...options, sample: doc.sample === true || options.sample === true });
  if (doc.kind === 'personal') bundle.personal = doc;
  else bundle.school = doc;
  saveBundle(bundle);
  return bundle;
}

export function writeTimetableFeed(feed: TimetableFeed): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FEED, JSON.stringify(feed));
}

export function readTimetableFeed(): TimetableFeed | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FEED);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimetableFeed;
    return parsed?.calendar ? parsed : null;
  } catch {
    return null;
  }
}
