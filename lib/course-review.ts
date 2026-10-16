/**
 * Course review desk. Pure decisions for the CMS preview:
 * Draft → In review → Approved → Published, the publish checklist,
 * the diff since the last publish, and who may see a lesson.
 * Firestore writes live in lib/course-review-store.ts.
 */

import { copyrightLine } from './insights/copyright';

export const REVIEW_FLOW = ['draft', 'in_review', 'approved', 'published'] as const;
export type ReviewStatus = (typeof REVIEW_FLOW)[number];

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  published: 'Published',
};

export const PREVIEW_DAYS = 7;
const MAX_PREVIEW_DAYS = 14;

export interface PreviewQuiz {
  question: string;
  options: string[];
  answer: string;
}

export interface PreviewImage {
  alt: string;
  src: string;
  caption?: string;
  missing?: boolean;
}

export interface PreviewMedia {
  kind: 'video' | 'audio';
  url: string;
  label: string;
}

export interface PreviewLinkRef {
  href: string;
  ok: boolean;
  reason?: string;
}

export interface PreviewLesson {
  id: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  status: ReviewStatus | 'archived';
  body: string;
  quiz: PreviewQuiz[];
  images: PreviewImage[];
  media: PreviewMedia[];
  links: PreviewLinkRef[];
}

export interface PreviewModule {
  id: string;
  title: string;
  lessons: PreviewLesson[];
}

export interface PreviewCourse {
  id: string;
  title: string;
  description: string;
  subject?: string;
  level?: string;
  language?: string;
  thumbnailUrl?: string;
  status: ReviewStatus;
  modules: PreviewModule[];
}

export interface ChecklistIssue {
  code: 'missing_images' | 'empty_lessons' | 'broken_links' | 'no_quiz';
  lessonId: string;
  lessonTitle: string;
  detail: string;
}

export interface SnapshotLesson {
  id: string;
  moduleTitle: string;
  title: string;
  body: string;
  quizCount: number;
  imageCount: number;
}

export interface PublishedSnapshot {
  at: number;
  lessons: SnapshotLesson[];
}

export interface ReviewDiffItem {
  id: string;
  title: string;
  kind: 'added' | 'removed' | 'changed';
  detail: string;
}

export interface LessonComment {
  id: string;
  lessonId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
}

export interface SourceLessonFields {
  id: string;
  title?: string;
  status?: string | null;
  moduleId: string;
  moduleTitle: string;
  body?: string;
  quiz?: { question?: string; options?: string[]; answer?: string }[];
  images?: { alt?: string; src?: string; caption?: string }[];
  media?: { kind?: string; url?: string; label?: string }[];
}

const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
const IMAGE_SLOT = /\[Image\s+(\d+)\s*:\s*([^\]]*)\]/gi;

export function reviewStatusOf(value: string | null | undefined): ReviewStatus {
  if (value === 'in_review' || value === 'pending_approval' || value === 'review') return 'in_review';
  if (value === 'approved') return 'approved';
  if (value === 'published') return 'published';
  return 'draft';
}

export function lessonStatusOf(value: string | null | undefined): PreviewLesson['status'] {
  if (value === 'archived') return 'archived';
  return reviewStatusOf(value);
}

export function nextReviewStatus(current: ReviewStatus): ReviewStatus | null {
  const index = REVIEW_FLOW.indexOf(current);
  if (index < 0 || index >= REVIEW_FLOW.length - 1) return null;
  return REVIEW_FLOW[index + 1] ?? null;
}

export function previousReviewStatus(current: ReviewStatus): ReviewStatus | null {
  const index = REVIEW_FLOW.indexOf(current);
  if (index <= 0) return null;
  return REVIEW_FLOW[index - 1] ?? null;
}

/** Marketplace `status` that matches the review step. Approved is not live yet. */
export function courseStatusForReview(status: ReviewStatus): 'draft' | 'pending_approval' | 'published' {
  if (status === 'published') return 'published';
  if (status === 'draft') return 'draft';
  return 'pending_approval';
}

/**
 * A course is on student pages only after it is published.
 * Older courses have no reviewStatus and follow `status` alone.
 * A review step that is not Published hides the course even if `status` was left behind.
 */
export function courseOpenToStudents(course: {
  status?: string | null;
  reviewStatus?: string | null;
}): boolean {
  if (course.reviewStatus && reviewStatusOf(course.reviewStatus) !== 'published') return false;
  if (!course.status) return !course.reviewStatus;
  return course.status === 'published';
}

/**
 * Students never receive draft, in-review, approved, or archived lessons.
 * Curriculum lessons without a status stay hidden. Older marketplace lessons
 * without a status stay visible once the course itself is published.
 */
export function lessonVisibleToStudent(
  lesson: { status?: string | null },
  course: { status?: string | null; reviewStatus?: string | null; kind?: string | null },
): boolean {
  if (!courseOpenToStudents(course)) return false;
  if (course.kind === 'curriculum') return lesson.status === 'published';
  if (!lesson.status) return true;
  return lesson.status === 'published';
}

export function visibleStudentLessons<T extends { status?: string | null }>(
  lessons: readonly T[],
  course: { status?: string | null; reviewStatus?: string | null; kind?: string | null },
): T[] {
  return lessons.filter(lesson => lessonVisibleToStudent(lesson, course));
}

/** Draft lessons stay hidden. Everything else goes live with the course. */
export function statusAfterCoursePublish(status: string | null | undefined): PreviewLesson['status'] {
  if (status === 'archived' || status === 'draft') return status;
  return 'published';
}

export function linkProblem(href: string): string | null {
  const value = href.trim();
  if (!value || value === '#' || value === 'http://' || value === 'https://') return 'Broken link';
  if (/^javascript:/i.test(value)) return 'Script link';
  if (/\s/.test(value)) return 'Broken link';
  if (/^mailto:/i.test(value)) {
    return value.includes('@') ? null : 'Broken link';
  }
  if (value.startsWith('/')) return value.length > 1 ? null : 'Broken link';
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!url.hostname || !url.hostname.includes('.')) return 'Broken link';
      return null;
    } catch {
      return 'Broken link';
    }
  }
  return 'Broken link';
}

export function linksInBody(body: string): PreviewLinkRef[] {
  const found: PreviewLinkRef[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(LINK_RE)) {
    const href = (match[2] || match[3] || '').trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const reason = linkProblem(href);
    found.push(reason ? { href, ok: false, reason } : { href, ok: true });
  }
  return found;
}

export function toPreviewLesson(source: SourceLessonFields): PreviewLesson {
  const body = (source.body ?? '').replace(/\r\n/g, '\n');
  const images: PreviewImage[] = (source.images ?? [])
    .filter(image => image && (image.src || image.alt || image.caption))
    .map(image => ({
      alt: (image.alt || image.caption || 'Illustration').trim() || 'Illustration',
      src: (image.src ?? '').trim(),
      caption: image.caption?.trim() || undefined,
      missing: !(image.src ?? '').trim(),
    }));
  const filled = images.filter(image => image.src).length;
  let slot = 0;
  for (const match of body.matchAll(IMAGE_SLOT)) {
    slot += 1;
    if (slot <= filled) continue;
    images.push({
      alt: (match[2] || `Image ${match[1]}`).trim() || `Image ${match[1]}`,
      src: '',
      caption: (match[2] || '').trim() || undefined,
      missing: true,
    });
  }
  const quiz = (source.quiz ?? [])
    .filter(item => item && String(item.question ?? '').trim())
    .map(item => ({
      question: String(item.question).trim(),
      options: (item.options ?? []).map(option => String(option)),
      answer: String(item.answer ?? ''),
    }));
  const media = (source.media ?? [])
    .filter(item => item?.url && (item.kind === 'video' || item.kind === 'audio'))
    .map(item => ({
      kind: item.kind as 'video' | 'audio',
      url: String(item.url),
      label: item.label?.trim() || (item.kind === 'audio' ? 'Audio' : 'Video'),
    }));
  return {
    id: source.id,
    moduleId: source.moduleId,
    moduleTitle: source.moduleTitle,
    title: (source.title ?? '').trim() || 'Untitled lesson',
    status: lessonStatusOf(source.status),
    body,
    quiz,
    images,
    media,
    links: linksInBody(body),
  };
}

export function flattenLessons(course: PreviewCourse): PreviewLesson[] {
  return course.modules.flatMap(module => module.lessons);
}

export function publishChecklist(course: PreviewCourse): ChecklistIssue[] {
  const issues: ChecklistIssue[] = [];
  const lessons = flattenLessons(course);
  let quizzes = 0;
  for (const lesson of lessons) {
    if (lesson.status === 'archived') continue;
    const text = lesson.body.replace(IMAGE_SLOT, '').trim();
    if (!text && lesson.quiz.length === 0 && lesson.media.length === 0 && lesson.images.every(image => !image.src)) {
      issues.push({
        code: 'empty_lessons',
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        detail: 'This lesson has no text, media, or quiz.',
      });
    }
    const missing = lesson.images.filter(image => image.missing || !image.src);
    if (missing.length) {
      issues.push({
        code: 'missing_images',
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        detail: missing.length === 1 ? '1 image is missing.' : `${missing.length} images are missing.`,
      });
    }
    const broken = lesson.links.filter(link => !link.ok);
    if (broken.length) {
      issues.push({
        code: 'broken_links',
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        detail: broken.map(link => link.href).join(', '),
      });
    }
    quizzes += lesson.quiz.length;
  }
  if (quizzes === 0) {
    issues.push({
      code: 'no_quiz',
      lessonId: lessons[0]?.id ?? '',
      lessonTitle: course.title,
      detail: 'This course has no quiz.',
    });
  }
  return issues;
}

export function checklistBlocksPublish(issues: readonly ChecklistIssue[]): boolean {
  return issues.some(issue => issue.code === 'empty_lessons' || issue.code === 'missing_images' || issue.code === 'broken_links');
}

export function snapshotFromCourse(course: PreviewCourse, at: number): PublishedSnapshot {
  return {
    at,
    lessons: flattenLessons(course).map(lesson => ({
      id: lesson.id,
      moduleTitle: lesson.moduleTitle,
      title: lesson.title,
      body: lesson.body,
      quizCount: lesson.quiz.length,
      imageCount: lesson.images.filter(image => image.src).length,
    })),
  };
}

export function diffSincePublish(course: PreviewCourse, snapshot: PublishedSnapshot | null): ReviewDiffItem[] {
  const current = flattenLessons(course);
  if (!snapshot) {
    return current.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      kind: 'added' as const,
      detail: 'Not in a published version yet.',
    }));
  }
  const previous = new Map(snapshot.lessons.map(lesson => [lesson.id, lesson]));
  const items: ReviewDiffItem[] = [];
  const seen = new Set<string>();
  for (const lesson of current) {
    seen.add(lesson.id);
    const before = previous.get(lesson.id);
    if (!before) {
      items.push({ id: lesson.id, title: lesson.title, kind: 'added', detail: `Added in ${lesson.moduleTitle}.` });
      continue;
    }
    const fields: string[] = [];
    if (before.title !== lesson.title) fields.push('title');
    if (before.body !== lesson.body) fields.push('text');
    if (before.quizCount !== lesson.quiz.length) fields.push('quiz');
    if (before.imageCount !== lesson.images.filter(image => image.src).length) fields.push('images');
    if (before.moduleTitle !== lesson.moduleTitle) fields.push('module');
    if (fields.length) {
      items.push({
        id: lesson.id,
        title: lesson.title,
        kind: 'changed',
        detail: `Changed: ${fields.join(', ')}.`,
      });
    }
  }
  for (const lesson of snapshot.lessons) {
    if (seen.has(lesson.id)) continue;
    items.push({ id: lesson.id, title: lesson.title, kind: 'removed', detail: `Removed from ${lesson.moduleTitle}.` });
  }
  return items;
}

export function commentIsValid(body: string): boolean {
  const text = body.trim();
  return text.length > 0 && text.length <= 2000;
}

export function previewExpiry(now: number, days = PREVIEW_DAYS): number {
  const span = Math.min(Math.max(days, 1), MAX_PREVIEW_DAYS);
  return now + span * 24 * 60 * 60 * 1000;
}

export function previewStillValid(expiresAt: number, now: number): boolean {
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function createPreviewToken(now = Date.now()): string {
  const salt = Math.random().toString(36).slice(2, 10);
  return `pv_${now.toString(36)}_${salt}`;
}

export function certificatePreviewCopy(courseTitle: string, moduleTitle: string, year = new Date().getFullYear()): {
  studentName: string;
  courseTitle: string;
  moduleTitle: string;
  issuedByName: string;
  copyright: string;
} {
  return {
    studentName: 'Student',
    courseTitle,
    moduleTitle,
    issuedByName: 'Poket School',
    copyright: copyrightLine(year),
  };
}
