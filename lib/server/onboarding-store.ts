import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { loadUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import {
  ONBOARDING_COURSE_ID,
  actionIsDone,
  buildWelcomeState,
  choiceCorrect,
  isOnboardingTrack,
  matchingActionIds,
  mergeOutline,
  recordsFromProfile,
  storedFromDoc,
  trackComplete,
  trackForProfile,
  welcomeBadge,
  welcomeCourseSeed,
  welcomeLessonSeeds,
  type OnboardingLesson,
  type OnboardingTrack,
  type StoredWelcomeLesson,
  type WelcomeProfile,
  type WelcomeState,
} from '@/lib/onboarding-course';

function firestore() {
  return adminDb();
}

export async function welcomeProfile(uid: string, mode?: string | null): Promise<WelcomeProfile> {
  const data = await loadUser(uid);
  const roles = Array.isArray(data?.roles) ? data.roles.filter((item): item is string => typeof item === 'string') : [];
  return {
    role: typeof data?.role === 'string' ? data.role : '',
    roles,
    institutionId: typeof data?.institutionId === 'string' ? data.institutionId : '',
    mode: mode ?? '',
    studentNumber: data?.studentNumber,
    childIds: data?.childIds,
  };
}

/** Creates the editable course once. A later admin edit is left alone. */
export async function ensureWelcomeCourse(): Promise<void> {
  const db = firestore();
  const ref = db.doc(`courses/${ONBOARDING_COURSE_ID}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    const course = welcomeCourseSeed();
    tx.set(ref, {
      ...course,
      enrollmentCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const module of welcomeLessonSeeds()) {
      tx.set(db.doc(`courses/${ONBOARDING_COURSE_ID}/modules/${module.moduleId}`), {
        title: module.moduleTitle,
        description: module.moduleTitle,
        courseId: ONBOARDING_COURSE_ID,
        order: module.order,
        estimatedHours: 1,
        sparkBudget: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
      for (const lesson of module.lessons) {
        const { id, ...rest } = lesson;
        tx.set(db.doc(`courses/${ONBOARDING_COURSE_ID}/modules/${module.moduleId}/lessons/${id}`), {
          ...rest,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  });
}

async function storedLessons(track: OnboardingTrack): Promise<StoredWelcomeLesson[] | null> {
  const snap = await firestore().collection(`courses/${ONBOARDING_COURSE_ID}/modules/${track}/lessons`).get();
  if (snap.empty) return null;
  return snap.docs
    .map((doc) => ({ doc, stored: storedFromDoc(doc.id, doc.data() as Record<string, unknown>) }))
    .sort((a, b) => {
      const left = typeof a.doc.get('order') === 'number' ? a.doc.get('order') as number : 0;
      const right = typeof b.doc.get('order') === 'number' ? b.doc.get('order') as number : 0;
      return left - right;
    })
    .map((item) => item.stored);
}

function actionKey(track: OnboardingTrack, actionId: string): string {
  return `${track}__${actionId}`;
}

async function doneActions(uid: string, track: OnboardingTrack, profile: WelcomeProfile): Promise<Set<string>> {
  const snap = await firestore().collection(`users/${uid}/onboarding_actions`).get();
  const ids = new Set(recordsFromProfile(profile));
  const prefix = `${track}__`;
  for (const doc of snap.docs) {
    if (!doc.id.startsWith(prefix)) continue;
    const actionId = typeof doc.get('actionId') === 'string' ? doc.get('actionId') as string : doc.id.slice(prefix.length);
    if (actionId) ids.add(actionId);
  }
  return ids;
}

async function enrollmentOf(uid: string): Promise<{ track: OnboardingTrack; skipped: boolean; checks: string[]; completed: string[] } | null> {
  const snap = await firestore().doc(`courses/${ONBOARDING_COURSE_ID}/enrollments/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    track: isOnboardingTrack(data.track) ? data.track : trackForProfile({}),
    skipped: data.skipped === true,
    checks: Array.isArray(data.welcomeChecks) ? data.welcomeChecks.filter((item): item is string => typeof item === 'string') : [],
    completed: Array.isArray(data.completedLessons) ? data.completedLessons.filter((item): item is string => typeof item === 'string') : [],
  };
}

async function awardWelcomeBadge(uid: string, track: OnboardingTrack): Promise<void> {
  const badge = welcomeBadge(track);
  const ref = firestore().doc(`badges/${uid}_${badge.type}`);
  const snap = await ref.get();
  if (snap.exists) return;
  await ref.set({
    userId: uid,
    type: badge.type,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    sparks: 0,
    awardedAt: FieldValue.serverTimestamp(),
  });
}

async function settleLessons(
  uid: string,
  track: OnboardingTrack,
  lessons: readonly OnboardingLesson[],
  checks: ReadonlySet<string>,
  actions: ReadonlySet<string>,
  completed: Set<string>,
): Promise<void> {
  const fresh = lessons.filter((lesson) => !completed.has(lesson.id) && checks.has(lesson.id) && actionIsDone(lesson, actions));
  for (const lesson of fresh) completed.add(lesson.id);
  if (fresh.length > 0) {
    const doneCount = lessons.filter((lesson) => completed.has(lesson.id)).length;
    await firestore().doc(`courses/${ONBOARDING_COURSE_ID}/enrollments/${uid}`).set({
      completedLessons: FieldValue.arrayUnion(...fresh.map((lesson) => lesson.id)),
      progress: lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0,
    }, { merge: true });
  }
  const rows = lessons.map((lesson) => ({
    lessonId: lesson.id,
    checkCorrect: checks.has(lesson.id) || completed.has(lesson.id),
    actionDone: actionIsDone(lesson, actions) || completed.has(lesson.id),
  }));
  if (trackComplete(lessons, rows)) await awardWelcomeBadge(uid, track);
}

async function readState(uid: string, profile: WelcomeProfile, track: OnboardingTrack, skipped: boolean, checks: readonly string[], completed: readonly string[]): Promise<WelcomeState> {
  const outline = mergeOutline(track, await storedLessons(track));
  const actions = await doneActions(uid, track, profile);
  const checkSet = new Set(checks);
  const completedSet = new Set(completed);
  for (const lesson of outline) {
    if (!completedSet.has(lesson.id)) continue;
    checkSet.add(lesson.id);
    if (lesson.action.id) actions.add(lesson.action.id);
  }
  await settleLessons(uid, track, outline, checkSet, actions, completedSet);
  for (const lesson of outline) {
    if (!completedSet.has(lesson.id)) continue;
    checkSet.add(lesson.id);
    if (lesson.action.id) actions.add(lesson.action.id);
  }
  return buildWelcomeState({
    track,
    lessons: outline,
    checks: checkSet,
    actions,
    skipped,
  });
}

export async function syncWelcome(uid: string, profile: WelcomeProfile): Promise<WelcomeState> {
  await ensureWelcomeCourse();
  const ref = firestore().doc(`courses/${ONBOARDING_COURSE_ID}/enrollments/${uid}`);
  const existing = await enrollmentOf(uid);
  const track = existing ? existing.track : trackForProfile(profile);
  if (!existing) {
    await ref.set({
      studentId: uid,
      courseId: ONBOARDING_COURSE_ID,
      track,
      progress: 0,
      completedLessons: [],
      welcomeChecks: [],
      skipped: false,
      enrolledAt: FieldValue.serverTimestamp(),
    });
  } else if (!isOnboardingTrack((await ref.get()).get('track'))) {
    await ref.set({ track }, { merge: true });
  }
  const current = (await enrollmentOf(uid)) ?? { track, skipped: false, checks: [], completed: [] };
  return readState(uid, profile, current.track, current.skipped, current.checks, current.completed);
}

export async function answerWelcome(uid: string, profile: WelcomeProfile, lessonId: string, choice: number): Promise<WelcomeState & { correct: boolean }> {
  const state = await syncWelcome(uid, profile);
  const lesson = state.lessons.find((item) => item.id === lessonId);
  const outline = mergeOutline(state.track, await storedLessons(state.track));
  const source = outline.find((item) => item.id === lessonId);
  if (!lesson || !source) throw new Error('That welcome lesson is not on your track.');
  const correct = Number.isInteger(choice) && choiceCorrect(source, choice);
  if (correct) {
    await firestore().doc(`courses/${ONBOARDING_COURSE_ID}/enrollments/${uid}`).set({
      welcomeChecks: FieldValue.arrayUnion(lessonId),
    }, { merge: true });
  }
  const next = await syncWelcome(uid, profile);
  return { ...next, correct };
}

export async function visitWelcome(uid: string, profile: WelcomeProfile, href: string): Promise<WelcomeState> {
  const existing = await enrollmentOf(uid);
  if (!existing) return syncWelcome(uid, profile);
  const outline = mergeOutline(existing.track, await storedLessons(existing.track));
  const ids = matchingActionIds(outline, href).slice(0, 8);
  const db = firestore();
  for (const actionId of ids) {
    await db.doc(`users/${uid}/onboarding_actions/${actionKey(existing.track, actionId)}`).set({
      actionId,
      track: existing.track,
      href: href.slice(0, 300),
      at: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  const current = (await enrollmentOf(uid)) ?? existing;
  return readState(uid, profile, current.track, current.skipped, current.checks, current.completed);
}

export async function skipWelcome(uid: string, profile: WelcomeProfile): Promise<WelcomeState> {
  await syncWelcome(uid, profile);
  await firestore().doc(`courses/${ONBOARDING_COURSE_ID}/enrollments/${uid}`).set({ skipped: true }, { merge: true });
  return syncWelcome(uid, profile);
}

export async function reopenWelcome(uid: string, profile: WelcomeProfile): Promise<WelcomeState> {
  await syncWelcome(uid, profile);
  await firestore().doc(`courses/${ONBOARDING_COURSE_ID}/enrollments/${uid}`).set({ skipped: false }, { merge: true });
  return syncWelcome(uid, profile);
}
