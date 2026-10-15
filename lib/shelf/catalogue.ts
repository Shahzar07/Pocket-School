import { courseCover } from '@/lib/course-cover';
import { courseMinTier, coursePriceType, freePreviewCount, tierDefinition } from '@/lib/entitlements';
import type { Course } from '@/lib/db';
import { SEED_COURSES } from '@/lib/seed-courses';
import { planLabel, SAMPLE_OWNED, SAMPLE_READER, type ReadsProfile } from '@/lib/reads/access';
import { decideBook } from '@/lib/platform/allocation';
import { quotePrice } from '@/lib/platform/pricing';
import { publishedBooks } from '@/lib/reads/seed';
import { ageNumber, type Book } from '@/lib/reads/types';
import type { ShelfBadge, ShelfItem } from './types';

export interface CourseView {
  id: string;
  href: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  type: string;
  price: number;
  currency: string;
  durationHours: number;
  tags: string[];
  image: string;
  whatYouLearn: string[];
  requirements: string[];
  ownerName: string;
  minTier?: number | null;
  priceType?: string | null;
  kind?: string | null;
  freePreviewCount?: number | null;
  weekly: number;
  releasedAt: string;
}

const COURSE_WEEKLY: Record<string, number> = {
  'igcse-biology-cells-to-systems': 1100,
  'spm-add-maths-foundations': 860,
  'english-essay-writing-mastery': 720,
  'intro-programming-python': 690,
  'spm-past-papers-bundle': 810,
};

function courseBadge(course: CourseView, currency = 'USD'): ShelfBadge {
  const like = {
    minTier: course.minTier,
    priceType: course.priceType,
    price: course.price,
    kind: course.kind,
    level: course.level,
    freePreviewCount: course.freePreviewCount,
  };
  const priceType = coursePriceType(like);
  if (priceType === 'FREE') return { label: 'Free', tone: 'free' };
  if (priceType === 'SUBSCRIPTION_INCLUDED' || priceType === 'INSTITUTION_ALLOCATED') {
    const tier = courseMinTier(like);
    return { label: tier > 0 ? `Included · ${tierDefinition(tier).name}` : 'Included', tone: 'included' };
  }
  return { label: quotePrice(course.price, course.currency || 'USD', currency).combined, tone: 'buy' };
}

export function seedCourseViews(): CourseView[] {
  return SEED_COURSES.map((course, index) => ({
    id: `seed:${course.seedKey}`,
    href: `/courses/catalogue/${course.seedKey}`,
    title: course.title,
    description: course.description,
    subject: course.subject,
    level: course.level,
    type: course.type,
    price: course.price,
    currency: course.currency,
    durationHours: course.durationHours,
    tags: course.tags,
    image: courseCover(course.title, course.subject, { paletteIndex: index }),
    whatYouLearn: course.whatYouLearn,
    requirements: course.requirements,
    ownerName: 'Poket School',
    kind: 'marketplace',
    weekly: COURSE_WEEKLY[course.seedKey] ?? 400,
    releasedAt: '2026-06-01',
  }));
}

export function liveCourseView(course: Course): CourseView {
  return {
    id: course.id,
    href: `/courses/${course.id}`,
    title: course.title,
    description: course.description ?? '',
    subject: course.subject ?? course.category ?? 'General',
    level: course.level ?? '',
    type: course.type ?? 'course',
    price: course.price ?? 0,
    currency: course.currency ?? 'MYR',
    durationHours: course.durationHours ?? 0,
    tags: course.tags ?? [],
    image: course.thumbnailUrl || courseCover(course.title, course.subject ?? ''),
    whatYouLearn: course.whatYouLearn ?? [],
    requirements: course.requirements ?? [],
    ownerName: course.ownerName || 'Poket School',
    minTier: course.minTier,
    priceType: course.priceType,
    kind: course.kind,
    freePreviewCount: course.freePreviewCount,
    weekly: 500 + (course.enrollmentCount ?? 0),
    releasedAt: '2026-05-01',
  };
}

export function mergeCourses(live: Course[]): CourseView[] {
  const seeds = seedCourseViews();
  const seen = new Set(live.map(c => c.title.trim().toLowerCase()));
  const fromLive = live.map(liveCourseView);
  const extras = seeds.filter(s => !seen.has(s.title.trim().toLowerCase()));
  return [...fromLive, ...extras];
}

export function courseToShelf(course: CourseView, progress?: number, currency = 'USD'): ShelfItem {
  const like = {
    price: course.price,
    priceType: course.priceType,
    kind: course.kind,
    freePreviewCount: course.freePreviewCount,
  };
  const preview = freePreviewCount(like);
  const extra = preview > 0 && preview < 1000 ? `${preview} free lesson${preview === 1 ? '' : 's'}` : undefined;
  return {
    id: course.id,
    kind: 'course',
    href: course.href,
    title: course.title,
    subtitle: course.ownerName,
    description: course.description,
    image: course.image,
    badge: courseBadge(course, currency),
    extra,
    tags: [...course.tags, course.subject, course.level, course.type].map(t => t.toLowerCase()),
    subject: course.subject,
    level: course.level,
    category: course.type,
    weekly: course.weekly,
    releasedAt: course.releasedAt,
    progress,
  };
}

export function bookBadge(book: Book, profile: ReadsProfile, ownedIds: readonly string[], currency = 'USD'): ShelfBadge {
  const access = decideBook(book, profile, { ownedIds });
  if (access.allowed && access.source === 'owned') return { label: 'Yours to keep', tone: 'owned' };
  if (access.allowed && (access.source === 'subscription' || access.source === 'institution')) {
    return { label: `Included · ${planLabel(book.minTier)}`, tone: 'included' };
  }
  if (access.allowed && access.source === 'sparks') return { label: 'Sparks', tone: 'included' };
  if (!access.allowed && access.reason === 'UPGRADE') {
    return { label: `Included · ${planLabel(book.minTier)}`, tone: 'locked' };
  }
  if (book.priceUsd > 0) return { label: quotePrice(book.priceUsd, 'USD', currency).combined, tone: access.allowed ? 'buy' : 'locked' };
  return { label: 'Preview', tone: 'preview' };
}

export function bookToShelf(book: Book, profile: ReadsProfile, ownedIds: readonly string[], progress?: number, currency = 'USD'): ShelfItem {
  return {
    id: book.id,
    kind: 'book',
    href: `/reads/book/${book.id}`,
    title: book.title,
    subtitle: 'ET AI',
    description: book.blurb,
    cover: book.cover,
    badge: bookBadge(book, profile, ownedIds, currency),
    extra: book.series ? `${book.series.name} · ${book.series.index}` : book.genre,
    tags: [book.genre, book.category, book.form, book.readingLevel, ...book.curriculumTags.flatMap(t => [t.subject, t.programme, t.year])].filter(Boolean).map(t => String(t).toLowerCase()),
    subject: book.curriculumTags[0]?.subject,
    level: book.readingLevel,
    category: book.category,
    form: book.form,
    age: ageNumber(book.ageRating),
    weekly: book.weeklyReads,
    releasedAt: book.releasedAt,
    seriesId: book.series?.id,
    seriesName: book.series?.name,
    seriesIndex: book.series?.index,
    progress,
  };
}

export function visibleBooks(profileMaxAge: number | null): Book[] {
  return publishedBooks().filter(book => profileMaxAge == null || ageNumber(book.ageRating) <= profileMaxAge);
}

export interface ShelfSignals {
  profile?: ReadsProfile;
  ownedIds?: readonly string[];
  maxAge?: number | null;
  progress?: Record<string, { percent: number }>;
  list?: string[];
  currency?: string;
}

export function allShelfItems(courses: CourseView[], signals: ShelfSignals = {}): ShelfItem[] {
  const profile = signals.profile ?? SAMPLE_READER;
  const owned = signals.ownedIds ?? SAMPLE_OWNED;
  const currency = signals.currency ?? 'USD';
  const books = visibleBooks(signals.maxAge ?? null).map(book =>
    bookToShelf(book, profile, owned, signals.progress?.[book.id]?.percent, currency),
  );
  const courseItems = courses.map(course => courseToShelf(course, signals.progress?.[course.id]?.percent, currency));
  return [...books, ...courseItems];
}

export function topTen(items: ShelfItem[]): ShelfItem[] {
  return [...items].sort((a, b) => b.weekly - a.weekly).slice(0, 10);
}

export function findCourse(courses: CourseView[], id: string): CourseView | undefined {
  return courses.find(c => c.id === id || c.href.endsWith('/' + id));
}

export function relatedBooksForCourse(subject: string, tags: string[]): Book[] {
  const hay = `${subject} ${tags.join(' ')}`.toLowerCase();
  return publishedBooks().filter(book => {
    const bookHay = `${book.genre} ${book.curriculumTags.map(t => `${t.subject} ${t.programme}`).join(' ')} ${book.title}`.toLowerCase();
    if (hay.includes('biology') && bookHay.includes('biology')) return true;
    if ((hay.includes('english') || hay.includes('essay') || hay.includes('writing')) && (bookHay.includes('english') || book.form === 'fiction')) return true;
    if (hay.includes('history') && bookHay.includes('history')) return true;
    if (hay.includes('math') && bookHay.includes('math')) return true;
    return false;
  }).slice(0, 8);
}

export function relatedCoursesForBook(book: Book, courses: CourseView[]): CourseView[] {
  const subject = (book.curriculumTags[0]?.subject ?? book.genre).toLowerCase();
  return courses.filter(course => {
    const hay = `${course.subject} ${course.tags.join(' ')} ${course.title}`.toLowerCase();
    if (subject.includes('biology') && hay.includes('biology')) return true;
    if (subject.includes('english') && (hay.includes('english') || hay.includes('essay'))) return true;
    if (subject.includes('history') && hay.includes('history')) return true;
    if (book.form === 'fiction' && hay.includes('english')) return true;
    return false;
  }).slice(0, 8);
}
