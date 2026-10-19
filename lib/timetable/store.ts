import { personalTimetable, schoolTimetable } from './seed';
import type { TimetableFeed } from './publish';
import type { TimetableDoc } from './types';

const KEY = 'poket-timetable-v1';
const FEED = 'poket-timetable-feed';

interface Bundle {
  school: TimetableDoc;
  personal: TimetableDoc;
}

function empty(): Bundle {
  return { school: schoolTimetable(), personal: personalTimetable() };
}

export function loadBundle(): Bundle {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Bundle>;
    return {
      school: parsed.school?.id ? parsed.school : schoolTimetable(),
      personal: parsed.personal?.id ? parsed.personal : personalTimetable(),
    };
  } catch {
    return empty();
  }
}

export function saveBundle(bundle: Bundle): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(bundle));
}

export function saveDoc(doc: TimetableDoc): Bundle {
  const bundle = loadBundle();
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
