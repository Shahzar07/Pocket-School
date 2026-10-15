/**
 * Teacher course studio decisions. Firestore writes stay in lib/db.ts.
 * Allocation uses AccessPolicy. Marketplace listing stays behind admin review.
 */

import { normalisePolicy, type AccessPolicy, type PolicyAudience } from './access-policy';
import { reorderById, withSequentialOrder } from './reorder';

export const COURSE_LEVELS = ['All', 'Primary', 'Secondary', 'GCSE', 'A-Level', 'University'] as const;

export const COURSE_CATEGORIES = [
  'Mathematics', 'Science', 'English', 'History', 'Languages',
  'Art', 'Technology', 'Business', 'Music', 'Other',
] as const;

export const COURSE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
] as const;

export type StudioStep = 'basics' | 'curriculum' | 'pricing' | 'allocation';

export const STUDIO_STEPS: { id: StudioStep; label: string; hint: string }[] = [
  { id: 'basics', label: 'Basics', hint: 'Title, audience, and the picture students see first' },
  { id: 'curriculum', label: 'Curriculum', hint: 'Sections, lectures, quizzes, assignments, and resources' },
  { id: 'pricing', label: 'Pricing', hint: 'USD price, a free option, and coupons' },
  { id: 'allocation', label: 'Students', hint: 'Who receives the course, including the marketplace' },
];

export type LectureKind = 'lecture' | 'quiz' | 'assignment' | 'resource';

export interface StudioQuizItem {
  question: string;
  options: string[];
  answer: string;
}

export interface StudioLecture {
  id: string;
  title: string;
  kind: LectureKind;
  body: string;
  resourceUrl?: string;
  quiz?: StudioQuizItem[];
}

export interface StudioSection {
  id: string;
  title: string;
  lectures: StudioLecture[];
}

export type StudioRole = 'teacher' | 'admin' | 'institution_admin';

export type AllocationTarget = 'students' | 'classes' | 'parents' | 'institution' | 'everyone' | 'marketplace';

const PLAIN = new Set<unknown>([Object.prototype, null]);

/** Drop undefined so Firestore addDoc and updateDoc accept the document. */
export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => omitUndefined(item)) as T;
  if (value && typeof value === 'object') {
    if (!PLAIN.has(Object.getPrototypeOf(value))) return value;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) next[key] = omitUndefined(item);
    }
    return next as T;
  }
  return value;
}

export function blankPolicy(): AccessPolicy {
  return { include: [], exclude: [] };
}

function ids(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

/** Map a studio choice onto the existing access policy. */
export function applyAllocationPreset(
  current: AccessPolicy,
  target: AllocationTarget,
  selectedIds: readonly string[] = [],
): AccessPolicy {
  const include = new Set<PolicyAudience>(current.include);
  if (target === 'students') include.add('users');
  if (target === 'classes') include.add('cohorts');
  if (target === 'parents') include.add('parents');
  if (target === 'institution') include.add('institutions');
  if (target === 'everyone') include.add('all');
  if (target === 'marketplace') include.add('marketplace');
  const next: AccessPolicy = { ...current, include: [...include] };
  const clean = ids(selectedIds);
  if (target === 'students' && clean.length) next.userIds = clean;
  if (target === 'classes' && clean.length) next.cohortIds = clean;
  if (target === 'institution' && clean.length) next.institutionIds = clean;
  return normalisePolicy(next);
}

export function includesMarketplace(policy: AccessPolicy | null | undefined): boolean {
  return !!policy?.include?.includes('marketplace');
}

/**
 * A teacher can hand a course to their own students immediately.
 * A marketplace listing waits for an admin to approve it.
 */
export function publishDecision(input: {
  intent: 'draft' | 'publish';
  policy: AccessPolicy;
  role: StudioRole;
}): { status: 'draft' | 'pending_approval' | 'published'; isPublic: boolean } {
  if (input.intent === 'draft') return { status: 'draft', isPublic: false };
  if (includesMarketplace(input.policy) && input.role !== 'admin') {
    return { status: 'pending_approval', isPublic: false };
  }
  if (includesMarketplace(input.policy)) return { status: 'published', isPublic: true };
  return { status: 'published', isPublic: false };
}

export function priceTypeFor(free: boolean, policy: AccessPolicy): 'FREE' | 'MARKETPLACE_PURCHASE' | 'INSTITUTION_ALLOCATED' {
  if (free) return 'FREE';
  if (policy.include.includes('institutions') && !includesMarketplace(policy)) return 'INSTITUTION_ALLOCATED';
  return 'MARKETPLACE_PURCHASE';
}

export interface CourseWriteInput {
  title: string;
  subtitle?: string;
  description: string;
  category?: string;
  level?: string;
  language?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  ownerId: string;
  ownerName?: string;
  price?: number;
  free?: boolean;
  policy: AccessPolicy;
  intent: 'draft' | 'publish';
  role: StudioRole;
}

/** The document createCourse and updateCourse should persist. No undefined values. */
export function courseWrite(input: CourseWriteInput): Record<string, unknown> {
  const policy = normalisePolicy(input.policy);
  const decision = publishDecision({ intent: input.intent, policy, role: input.role });
  const free = !!input.free || !(input.price && input.price > 0);
  const price = free ? 0 : Math.round(Number(input.price) * 100) / 100;
  return omitUndefined({
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || undefined,
    description: input.description.trim(),
    category: input.category?.trim() || undefined,
    level: input.level?.trim() || undefined,
    language: input.language?.trim() || undefined,
    thumbnailUrl: input.thumbnailUrl?.trim() || undefined,
    previewUrl: input.previewUrl?.trim() || undefined,
    ownerId: input.ownerId,
    ownerName: input.ownerName?.trim() || undefined,
    price,
    currency: 'USD',
    priceType: priceTypeFor(free, policy),
    status: decision.status,
    isPublic: decision.isPublic,
    kind: 'marketplace' as const,
    type: 'course' as const,
    accessPolicy: policy,
    audiences: policy.include.filter(item =>
      ['students', 'teachers', 'parents', 'institutions', 'all', 'marketplace'].includes(item),
    ),
  });
}

function listingFlags(data: { status?: string; isPublic?: boolean; include?: readonly string[] }): boolean {
  if (data.status !== 'published') return false;
  if (data.isPublic) return true;
  return (data.include ?? []).includes('marketplace');
}

/**
 * Mirrors the course write rule: a teacher edits only their own course, and
 * cannot flip it onto the public marketplace. An admin can.
 */
export function teacherMayWriteCourse(input: {
  actorRole: StudioRole | 'student';
  actorId: string;
  ownerId: string;
  nextOwnerId: string;
  next: { status: string; isPublic?: boolean; include?: readonly string[] };
  previous?: { status: string; isPublic?: boolean; include?: readonly string[] };
}): boolean {
  if (input.actorRole === 'student') return false;
  if (input.actorRole === 'admin') return true;
  if (input.actorId !== input.ownerId || input.nextOwnerId !== input.ownerId) return false;
  if (!listingFlags(input.next)) return true;
  return !!input.previous && listingFlags(input.previous);
}

export function awaitsMarketplaceReview(course: {
  accessPolicy?: { include?: readonly string[] } | null;
  audiences?: readonly string[] | null;
}): boolean {
  if (course.accessPolicy?.include?.includes('marketplace')) return true;
  if (course.audiences?.includes('marketplace')) return true;
  if (!course.accessPolicy && !(course.audiences && course.audiences.length)) return true;
  return false;
}

export function moveStudioSection(sections: readonly StudioSection[], fromId: string, toId: string): StudioSection[] {
  return withSequentialOrder(reorderById(sections, fromId, toId)).map(({ order: _order, ...section }) => section);
}

export function moveStudioLecture(
  sections: readonly StudioSection[],
  sectionId: string,
  fromId: string,
  toId: string,
): StudioSection[] {
  return sections.map(section => {
    if (section.id !== sectionId) return section;
    return { ...section, lectures: reorderById(section.lectures, fromId, toId) };
  });
}

export function instructorSnapshot(input: {
  courses: readonly { enrollmentCount?: number; revenueTotal?: number }[];
  reviews: readonly { rating: number }[];
  questions: readonly { reply?: string | null }[];
}): {
  enrollments: number;
  revenue: number;
  average: number | null;
  reviewCount: number;
  openQuestions: number;
  questionCount: number;
} {
  const ratings = input.reviews.map(review => review.rating).filter(rating => rating >= 1 && rating <= 5);
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
    : null;
  return {
    enrollments: input.courses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0),
    revenue: Math.round(input.courses.reduce((sum, course) => sum + (course.revenueTotal || 0), 0) * 100) / 100,
    average,
    reviewCount: ratings.length,
    openQuestions: input.questions.filter(question => !question.reply?.trim()).length,
    questionCount: input.questions.length,
  };
}

let studioSeq = 0;

export function studioId(prefix: string): string {
  studioSeq += 1;
  return `new-${prefix}-${studioSeq}`;
}

export function emptyLecture(kind: LectureKind = 'lecture'): StudioLecture {
  return {
    id: studioId(kind),
    title: kind === 'quiz' ? 'Quiz' : kind === 'assignment' ? 'Assignment' : kind === 'resource' ? 'Resource' : 'Lecture',
    kind,
    body: '',
    quiz: kind === 'quiz' ? [{ question: '', options: ['', '', '', ''], answer: '' }] : undefined,
  };
}

export function emptySection(): StudioSection {
  return { id: studioId('section'), title: 'New section', lectures: [emptyLecture()] };
}
