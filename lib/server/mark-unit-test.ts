import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { isPublishedLesson } from '../progress';
import {
  gradeUnitTest,
  questionsForVersion,
  resolvePassMark,
  reviewGate,
  toAttemptSnapshot,
  versionForAttempt,
  type UnitTestContent,
} from '../unit-test';
import { issueCourseCertificate } from '../certificates/issue';
import { ActionError, completeLesson, grantUnitPassReward } from './actions';

export interface MarkUnitTestBody {
  courseId: string;
  unitId: string;
  lessonId: string;
  /** Option ids (`opt:0`). A score on this body is ignored. */
  answers?: { questionId?: string; selected?: string }[];
  /** Older clients send one selected id per question, in paper order. */
  responses?: { selected?: string }[];
  timeTakenSeconds?: number;
}

export async function markUnitTestAttempt(uid: string, body: MarkUnitTestBody) {
  const courseId = body.courseId.trim();
  const unitId = body.unitId.trim();
  const lessonId = body.lessonId.trim();
  if (!courseId || !unitId || !lessonId) throw new ActionError('NOT_FOUND', 'Unit test not found');

  const [courseSnap, lessonSnap, enrollSnap, userSnap] = await Promise.all([
    adminDb().doc(`courses/${courseId}`).get(),
    adminDb().doc(`courses/${courseId}/modules/${unitId}/lessons/${lessonId}`).get(),
    adminDb().doc(`courses/${courseId}/enrollments/${uid}`).get(),
    adminDb().doc(`users/${uid}`).get(),
  ]);
  if (!courseSnap.exists || !lessonSnap.exists) throw new ActionError('NOT_FOUND', 'Unit test not found');
  if (!enrollSnap.exists) throw new ActionError('NOT_ENROLLED', 'Enrol in this course before the unit test.');
  const lesson = lessonSnap.data() ?? {};
  if (lesson.lessonType !== 'unit_test' || !lesson.unitTest) {
    throw new ActionError('NOT_FOUND', 'That lesson is not a unit test.');
  }
  if (!isPublishedLesson({ status: lesson.status as string | undefined })) {
    throw new ActionError('NOT_FOUND', 'This unit test is not published.');
  }

  const modSnap = await adminDb().doc(`courses/${courseId}/modules/${unitId}`).get();
  const threshold = resolvePassMark(
    courseSnap.data() as { unitTestPassMark?: number },
    modSnap.data() as { unitTestPassMark?: number; masteryThreshold?: number } | undefined,
  );
  const prev = await adminDb().collection('unit_quiz_attempts')
    .where('studentId', '==', uid)
    .where('lessonId', '==', lessonId)
    .get();
  const completedAt = enrollSnap.data()?.lessonCompletedAt as Record<string, number> | undefined;
  const gate = reviewGate(prev.docs.map((doc) => toAttemptSnapshot(doc.data())), completedAt, lessonId);
  if (gate.locked) throw new ActionError('LOCKED', 'Review these lessons before the unit test unlocks.');

  const paper = questionsForVersion(lesson.unitTest as UnitTestContent, gate.nextVersion);
  if (paper.length === 0) throw new ActionError('NOT_FOUND', 'This unit test has no questions.');
  const selected: Record<string, string> = {};
  const byId = new Map<string, string>();
  for (const answer of body.answers ?? []) {
    const questionId = answer.questionId?.trim();
    if (questionId) byId.set(questionId, (answer.selected ?? '').trim());
  }
  paper.forEach((question, index) => {
    const fromId = byId.get(question.id);
    const fromOrder = (body.responses?.[index]?.selected ?? body.answers?.[index]?.selected ?? '').trim();
    selected[question.id] = fromId ?? fromOrder;
  });
  const result = gradeUnitTest(paper, selected, threshold);
  const attemptNumber = prev.size + 1;
  const version = versionForAttempt(attemptNumber);
  const studentName = typeof userSnap.data()?.name === 'string' ? userSnap.data()?.name as string : '';
  const ref = await adminDb().collection('unit_quiz_attempts').add({
    studentId: uid,
    studentName,
    courseId,
    unitId,
    lessonId,
    kind: 'unit_test',
    version,
    attemptNumber,
    score: result.score,
    total: result.total,
    marksAwarded: result.marksAwarded,
    marksMax: result.marksMax,
    percentage: result.percentage,
    passed: result.passed,
    timeTakenSeconds: clampTime(body.timeTakenSeconds),
    responses: result.responses,
    ...(result.weakestObjective ? { weakestObjective: result.weakestObjective } : {}),
    recommendedLessonIds: result.recommendedLessonIds,
    completedAt: FieldValue.serverTimestamp(),
  });

  let counted = false;
  let unlockedUnitId: string | null = null;
  let certificate = null;
  if (result.passed) {
    const completion = await completeLesson(uid, courseId, lessonId, 100, false);
    counted = completion.accepted !== false;
    if (counted && !completion.already) {
      await grantUnitPassReward(uid, 'Unit test passed');
    }
    const modules = await adminDb().collection(`courses/${courseId}/modules`).orderBy('order').get();
    const index = modules.docs.findIndex((doc) => doc.id === unitId);
    const next = index >= 0 ? modules.docs[index + 1] : undefined;
    unlockedUnitId = next?.id ?? null;
    await enrollSnap.ref.update({
      [`unitProgress.${unitId}`]: {
        passed: true,
        score: result.percentage,
        lessonId,
        passedAt: Date.now(),
      },
      ...(unlockedUnitId ? { unlockedUnitIds: FieldValue.arrayUnion(unlockedUnitId) } : {}),
    });
    certificate = await issueCourseCertificate(uid, courseId);
  }

  return {
    id: ref.id,
    attemptId: ref.id,
    studentId: uid,
    courseId,
    unitId,
    lessonId,
    kind: 'unit_test' as const,
    version,
    attemptNumber,
    score: result.percentage,
    percentage: result.percentage,
    marksAwarded: result.marksAwarded,
    marksMax: result.marksMax,
    total: result.total,
    passed: result.passed,
    counted,
    unlockedUnitId,
    certificate,
    weakestObjective: result.weakestObjective,
    lessonIds: result.recommendedLessonIds,
    recommendedLessonIds: result.recommendedLessonIds,
    responses: result.responses,
  };
}

function clampTime(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value), 24 * 60 * 60);
}
