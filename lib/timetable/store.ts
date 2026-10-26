import { blankTimetable, isInventedTimetable, personalTimetable, schoolTimetable } from './seed';
import type { TimetableFeed } from './publish';
import type { TimetableDoc } from './types';

const KEY = 'poket-timetable-v1';
const FEED = 'poket-timetable-feed';

/** Sample weeks share one key. A live school week is stored for that institution only. */
export function timetableSchoolKey(options: BundleOptions = {}): string {
  if (options.sample || !options.institutionId) return KEY;
  return `${KEY}:school:${options.institutionId}`;
}

export function timetablePersonalKey(options: BundleOptions = {}): string {
  if (options.sample || !options.ownerId) return KEY;
  return `${KEY}:personal:${options.ownerId}`;
}

function feedKey(options: BundleOptions = {}): string {
  if (options.sample || !options.institutionId) return FEED;
  return `${FEED}:${options.institutionId}`;
}

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

function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

function parseDoc(raw: string | null): TimetableDoc | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as TimetableDoc;
    return parsed?.id ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseBundle(raw: string | null): Partial<Bundle> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<Bundle> & TimetableDoc;
    if (parsed?.school || parsed?.personal) return parsed;
    return {};
  } catch {
    return {};
  }
}

function storedSchool(options: BundleOptions): TimetableDoc | undefined {
  const sample = options.sample === true;
  const direct = parseDoc(readRaw(timetableSchoolKey(options)));
  if (direct && direct.kind !== 'personal') return direct;
  const legacy = parseBundle(readRaw(KEY)).school;
  if (!legacy) return undefined;
  if (sample || !options.institutionId) return legacy;
  if (legacy.institutionId !== options.institutionId) return undefined;
  return legacy;
}

function storedPersonal(options: BundleOptions): TimetableDoc | undefined {
  const sample = options.sample === true;
  const direct = parseDoc(readRaw(timetablePersonalKey(options)));
  if (direct?.kind === 'personal') return direct;
  const legacy = parseBundle(readRaw(KEY)).personal;
  if (!legacy) return undefined;
  if (sample || !options.ownerId) return legacy;
  if (legacy.ownerId && legacy.ownerId !== options.ownerId) return undefined;
  return legacy;
}

export function loadBundle(options: BundleOptions = {}): Bundle {
  const base = fresh(options);
  if (typeof window === 'undefined') return base;
  const sample = options.sample === true;
  return {
    school: keep(storedSchool(options), base.school, sample),
    personal: keep(storedPersonal(options), base.personal, sample),
  };
}

export function saveBundle(bundle: Bundle, options: BundleOptions = {}): void {
  const sample = options.sample === true || bundle.school.sample === true || bundle.personal.sample === true;
  if (sample) {
    writeRaw(KEY, JSON.stringify(bundle));
    return;
  }
  const schoolOptions = { sample: false, institutionId: bundle.school.institutionId || options.institutionId, ownerId: options.ownerId };
  const personalOptions = { sample: false, ownerId: bundle.personal.ownerId || options.ownerId, institutionId: options.institutionId };
  if (schoolOptions.institutionId) writeRaw(timetableSchoolKey(schoolOptions), JSON.stringify(bundle.school));
  if (personalOptions.ownerId) writeRaw(timetablePersonalKey(personalOptions), JSON.stringify(bundle.personal));
  if (!schoolOptions.institutionId && !personalOptions.ownerId) writeRaw(KEY, JSON.stringify(bundle));
}

export function saveDoc(doc: TimetableDoc, options: BundleOptions = {}): Bundle {
  const sample = doc.sample === true || options.sample === true;
  const nextOptions = {
    sample,
    institutionId: doc.institutionId || options.institutionId,
    ownerId: doc.ownerId || options.ownerId,
  };
  const bundle = loadBundle(nextOptions);
  if (doc.kind === 'personal') bundle.personal = doc;
  else bundle.school = doc;
  saveBundle(bundle, nextOptions);
  return bundle;
}

export function writeTimetableFeed(feed: TimetableFeed, options: BundleOptions = {}): void {
  writeRaw(feedKey(options), JSON.stringify(feed));
}

export function readTimetableFeed(options: BundleOptions = {}): TimetableFeed | null {
  try {
    const raw = readRaw(feedKey(options));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimetableFeed;
    return parsed?.calendar ? parsed : null;
  } catch {
    return null;
  }
}
