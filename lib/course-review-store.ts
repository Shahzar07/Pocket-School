/**
 * Firestore reads and writes for the review desk.
 * The preview link stores a snapshot so a guest never reads an unpublished course.
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateCourse, updateLesson } from '@/lib/db';
import {
  commentIsValid,
  courseStatusForReview,
  createPreviewToken,
  previewExpiry,
  previewStillValid,
  type LessonComment,
  type PreviewCourse,
  type PublishedSnapshot,
  type ReviewStatus,
} from '@/lib/course-review';

export async function saveCourseReview(courseId: string, status: ReviewStatus, snapshot?: PublishedSnapshot): Promise<void> {
  await updateCourse(courseId, {
    reviewStatus: status,
    status: courseStatusForReview(status),
    ...(status === 'published' ? {} : { isPublic: false }),
    ...(snapshot ? { publishedSnapshot: snapshot } : {}),
  });
}

export async function publishLessonStatus(
  courseId: string,
  lessons: { id: string; moduleId: string; status: string }[],
): Promise<void> {
  for (const lesson of lessons) {
    await updateLesson(courseId, lesson.moduleId, lesson.id, {
      status: lesson.status as 'draft' | 'in_review' | 'approved' | 'published' | 'archived',
    });
  }
}

export async function addLessonComment(
  courseId: string,
  comment: Omit<LessonComment, 'id' | 'createdAt'> & { createdAt?: number },
): Promise<string> {
  if (!commentIsValid(comment.body)) throw new Error('Write a comment of 2,000 characters or fewer.');
  const ref = await addDoc(collection(db, 'courses', courseId, 'reviewComments'), {
    lessonId: comment.lessonId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body.trim(),
    createdAt: comment.createdAt ?? Date.now(),
    createdAtServer: serverTimestamp(),
  });
  return ref.id;
}

export async function listLessonComments(courseId: string): Promise<LessonComment[]> {
  const snap = await getDocs(collection(db, 'courses', courseId, 'reviewComments'));
  return snap.docs.map(item => {
    const data = item.data() as Omit<LessonComment, 'id'>;
    return {
      id: item.id,
      lessonId: data.lessonId,
      authorId: data.authorId,
      authorName: data.authorName || 'Teacher',
      body: data.body,
      createdAt: Number(data.createdAt) || Date.now(),
    };
  }).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createCoursePreviewLink(input: {
  courseId: string;
  createdBy: string;
  course: PreviewCourse;
  now?: number;
}): Promise<{ token: string; expiresAt: number }> {
  const now = input.now ?? Date.now();
  const token = createPreviewToken(now);
  const expiresAt = previewExpiry(now);
  await setDoc(doc(db, 'coursePreviews', token), {
    token,
    courseId: input.courseId,
    createdBy: input.createdBy,
    expiresAt,
    course: input.course,
    createdAt: serverTimestamp(),
  });
  return { token, expiresAt };
}

export async function readCoursePreview(token: string, now = Date.now()): Promise<{ course: PreviewCourse; expiresAt: number } | null> {
  const snap = await getDoc(doc(db, 'coursePreviews', token));
  if (!snap.exists()) return null;
  const data = snap.data() as { course?: PreviewCourse; expiresAt?: number };
  if (!data.course || !previewStillValid(Number(data.expiresAt), now)) return null;
  return { course: data.course, expiresAt: Number(data.expiresAt) };
}

export async function revokeCoursePreview(token: string): Promise<void> {
  await deleteDoc(doc(db, 'coursePreviews', token));
}
