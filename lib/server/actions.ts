import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { hasAccountRole } from '../account-modes';
import { publicDisplayName } from '../display-name';
import { canDirectMessage } from '../community/policy';
import { asAgeTier, isAgeTier } from '../age-tier';
import { accessTierFor, freePreviewCount, tierDefinition, type AccessTier } from '../entitlements';
import { answersMatch } from '../quiz';
import { isPublishedLesson, progressPercent } from '../progress';
import {
  ADMIN_SPARKS_GRANT,
  FORMAT_COSTS,
  LESSON_COMPLETE_REWARD,
  SIGNUP_GRANT,
  UNIT_PASS_REWARD,
  getFormatCost,
  monthlySparksForProfile,
  sparksRolloverForProfile,
} from '../sparks';

function db(): Firestore {
  return adminDb();
}

export class ActionError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

interface LessonHit {
  id: string;
  moduleId: string;
  data: FirebaseFirestore.DocumentData;
}

async function loadCourse(courseId: string) {
  const snap = await db().doc(`courses/${courseId}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Course not found');
  return snap.data() ?? {};
}

async function listLessons(courseId: string): Promise<LessonHit[]> {
  const modules = await db().collection(`courses/${courseId}/modules`).orderBy('order').get();
  const groups = await Promise.all(modules.docs.map(async (mod) => {
    const lessons = await db().collection(`courses/${courseId}/modules/${mod.id}/lessons`).orderBy('order').get();
    return lessons.docs.map((d) => ({ id: d.id, moduleId: mod.id, data: d.data() }));
  }));
  return groups.flat();
}

async function findLesson(courseId: string, lessonId: string): Promise<LessonHit | null> {
  const all = await listLessons(courseId);
  return all.find((l) => l.id === lessonId) ?? null;
}

function lessonContent(data: FirebaseFirestore.DocumentData): Record<string, unknown> | undefined {
  const outputs = data.aiOutputs;
  if (outputs && typeof outputs === 'object') return outputs as Record<string, unknown>;
  return undefined;
}

async function readProtected(courseId: string, moduleId: string, lessonId: string) {
  const snap = await db().doc(`courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/protected/content`).get();
  if (!snap.exists) return undefined;
  const outputs = snap.data()?.aiOutputs;
  return outputs && typeof outputs === 'object' ? outputs as Record<string, unknown> : undefined;
}

async function writePublicXp(uid: string, name: string, xp: number, role: string) {
  await db().doc(`public_profiles/${uid}`).set({
    displayName: publicDisplayName(name),
    xp,
    role,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function publishedFlat(course: FirebaseFirestore.DocumentData, lessons: LessonHit[]): LessonHit[] {
  if (course.kind === 'curriculum') return lessons.filter((l) => l.data.status === 'published');
  return lessons.filter((l) => isPublishedLesson({ status: l.data.status as string | undefined }));
}

export async function unlockFormat(uid: string, courseId: string, lessonId: string, format: string) {
  if (!FORMAT_COSTS[format] && format !== 'summary') {
    throw new ActionError('UNKNOWN_FORMAT', 'That format cannot be unlocked.');
  }
  const cost = getFormatCost(format);
  const userRef = db().doc(`users/${uid}`);
  const enrollRef = db().doc(`courses/${courseId}/enrollments/${uid}`);
  const course = await loadCourse(courseId);
  const lessons = publishedFlat(course, await listLessons(courseId));
  const index = lessons.findIndex((l) => l.id === lessonId);
  const waived = course.kind === 'curriculum' && index >= 0 && index < freePreviewCount(course);

  const balance = await db().runTransaction(async (tx) => {
    const [userSnap, enrollSnap] = await Promise.all([tx.get(userRef), tx.get(enrollRef)]);
    if (!userSnap.exists) throw new ActionError('USER_NOT_FOUND');
    if (!enrollSnap.exists) throw new ActionError('NOT_ENROLLED');
    const current = (userSnap.data()?.sparksBalance as number | undefined) ?? 0;
    const unlocked = (enrollSnap.data()?.unlockedFormats as Record<string, string[]> | undefined) ?? {};
    if (unlocked[lessonId]?.includes(format) || waived) {
      if (waived && !unlocked[lessonId]?.includes(format)) {
        tx.update(enrollRef, { [`unlockedFormats.${lessonId}`]: FieldValue.arrayUnion(format) });
      }
      return current;
    }
    if (current < cost) throw new ActionError('INSUFFICIENT_SPARKS');
    const balanceAfter = current - cost;
    tx.update(userRef, { sparksBalance: balanceAfter, updatedAt: FieldValue.serverTimestamp() });
    tx.update(enrollRef, { [`unlockedFormats.${lessonId}`]: FieldValue.arrayUnion(format) });
    tx.set(userRef.collection('spark_transactions').doc(), {
      amount: -cost,
      type: 'unlock',
      format,
      courseId,
      lessonId,
      balanceAfter,
      note: `Unlocked ${format}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return balanceAfter;
  });
  return { balance, cost: waived ? 0 : cost };
}

export async function completeLesson(
  uid: string,
  courseId: string,
  lessonId: string,
  xpReward = 50,
  grantLessonSparks = true,
) {
  const course = await loadCourse(courseId);
  const lessons = publishedFlat(course, await listLessons(courseId));
  // A passed unit quiz pays UNIT_PASS_REWARD on its own. Completing that quiz
  // lesson must not also pay the ordinary lesson reward.
  const sparksReward = grantLessonSparks && course.kind === 'curriculum' ? LESSON_COMPLETE_REWARD : 0;
  const userRef = db().doc(`users/${uid}`);
  const enrollRef = db().doc(`courses/${courseId}/enrollments/${uid}`);

  const result = await db().runTransaction(async (tx) => {
    const [userSnap, enrollSnap] = await Promise.all([tx.get(userRef), tx.get(enrollRef)]);
    if (!userSnap.exists) throw new ActionError('USER_NOT_FOUND');
    if (!enrollSnap.exists) throw new ActionError('NOT_ENROLLED');
    const enrollment = enrollSnap.data() ?? {};
    const completed: string[] = Array.isArray(enrollment.completedLessons) ? enrollment.completedLessons : [];
    if (completed.includes(lessonId)) {
      return { already: true, balance: (userSnap.data()?.sparksBalance as number) ?? 0, xp: (userSnap.data()?.xp as number) ?? 0 };
    }
    const done = completed.length + 1;
    const progress = progressPercent(done, lessons.length || 1);
    const balance = ((userSnap.data()?.sparksBalance as number) ?? 0) + sparksReward;
    const xp = ((userSnap.data()?.xp as number) ?? 0) + xpReward;
    tx.update(enrollRef, {
      completedLessons: FieldValue.arrayUnion(lessonId),
      progress,
    });
    tx.update(userRef, {
      xp,
      ...(sparksReward > 0 ? { sparksBalance: balance } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (sparksReward > 0) {
      tx.set(userRef.collection('spark_transactions').doc(), {
        amount: sparksReward,
        type: 'earn',
        courseId,
        lessonId,
        balanceAfter: balance,
        note: 'Lesson completed',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return { already: false, balance, xp, name: (userSnap.data()?.name as string) ?? '', role: (userSnap.data()?.role as string) ?? 'student' };
  });

  if (!result.already) {
    await writePublicXp(uid, result.name ?? '', result.xp, result.role ?? 'student');
    await awardBadges(uid, result.xp);
  }
  return result;
}

async function awardBadges(uid: string, xp: number) {
  const milestones = [
    { threshold: 100, type: 'first_steps', name: 'First Steps', description: 'Earn your first 100 XP', icon: '🌱' },
    { threshold: 500, type: 'rising_star', name: 'Rising Star', description: 'Earn 500 XP', icon: '⭐' },
    { threshold: 1000, type: 'knowledge_seeker', name: 'Knowledge Seeker', description: 'Earn 1000 XP', icon: '📚' },
    { threshold: 5000, type: 'scholar', name: 'Scholar', description: 'Earn 5000 XP', icon: '🎓' },
  ];
  for (const m of milestones) {
    if (xp < m.threshold) continue;
    const ref = db().doc(`badges/${uid}_${m.type}`);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        userId: uid, type: m.type, name: m.name, description: m.description, icon: m.icon,
        awardedAt: FieldValue.serverTimestamp(),
      });
    }
  }
}

async function addSparks(uid: string, amount: number, type: string, note: string, extra: Record<string, unknown> = {}) {
  const userRef = db().doc(`users/${uid}`);
  const balance = await db().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new ActionError('USER_NOT_FOUND');
    const balanceAfter = ((snap.data()?.sparksBalance as number) ?? 0) + amount;
    tx.update(userRef, { sparksBalance: balanceAfter, updatedAt: FieldValue.serverTimestamp(), ...extra });
    tx.set(userRef.collection('spark_transactions').doc(), {
      amount,
      type,
      balanceAfter,
      note,
      createdAt: FieldValue.serverTimestamp(),
    });
    return balanceAfter;
  });
  return balance;
}

export async function grantWelcome(uid: string) {
  const userRef = db().doc(`users/${uid}`);
  const snap = await userRef.get();
  if (!snap.exists) throw new ActionError('USER_NOT_FOUND');
  if (snap.data()?.sparksWelcomeGrantedAt) return { granted: false, balance: (snap.data()?.sparksBalance as number) ?? 0 };
  const balance = await addSparks(uid, SIGNUP_GRANT, 'admin_grant', 'Welcome bonus', {
    sparksWelcomeGrantedAt: FieldValue.serverTimestamp(),
  });
  return { granted: true, balance };
}

export async function grantMonthly(uid: string) {
  const userRef = db().doc(`users/${uid}`);
  const snap = await userRef.get();
  if (!snap.exists) throw new ActionError('USER_NOT_FOUND');
  const profile = snap.data() ?? {};
  const allowance = monthlySparksForProfile(profile as { accessTier?: number; subscriptionTier?: string; role?: string; sparksMonthlyAllowance?: number });
  if (allowance <= 0) return { granted: false, balance: (profile.sparksBalance as number) ?? 0, allowance: 0 };
  const last = profile.sparksGrantedAt as { toMillis?: () => number } | undefined;
  if (last?.toMillis) {
    const days = (Date.now() - last.toMillis()) / (1000 * 60 * 60 * 24);
    if (days < 30) return { granted: false, balance: (profile.sparksBalance as number) ?? 0, allowance };
  }
  const rollover = sparksRolloverForProfile(profile as { accessTier?: number; subscriptionTier?: string; role?: string });
  const kept = Math.min((profile.sparksBalance as number) ?? 0, rollover);
  const target = kept + allowance;
  const delta = target - ((profile.sparksBalance as number) ?? 0);
  const balance = await addSparks(uid, delta, 'allowance', 'Monthly plan allowance', {
    sparksGrantedAt: FieldValue.serverTimestamp(),
    sparksMonthlyAllowance: allowance,
  });
  return { granted: true, balance, allowance };
}

export async function adminGrant(actorUid: string, targetUid: string, amount: number, note: string) {
  if (!Number.isFinite(amount) || amount === 0) throw new ActionError('INVALID_AMOUNT', 'Enter a non-zero amount.');
  const actor = await db().doc(`users/${actorUid}`).get();
  if (actor.data()?.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only an admin can grant Sparks.');
  const balance = await addSparks(targetUid, amount, 'admin_grant', note || 'Granted by an admin');
  return { balance };
}

export async function ensureAdminBootstrap(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) return { granted: false };
  const data = snap.data() ?? {};
  if (data.role !== 'admin' || data.adminSparksGrantedAt) return { granted: false, balance: (data.sparksBalance as number) ?? 0 };
  const balance = await addSparks(uid, ADMIN_SPARKS_GRANT, 'admin_grant', 'Administrator working balance', {
    adminSparksGrantedAt: FieldValue.serverTimestamp(),
  });
  return { granted: true, balance };
}

export async function setSubscription(actorUid: string, targetUid: string, accessTier: AccessTier) {
  const actor = await db().doc(`users/${actorUid}`).get();
  if (actor.data()?.role !== 'admin') throw new ActionError('FORBIDDEN');
  const def = tierDefinition(accessTier);
  await db().doc(`users/${targetUid}`).set({
    accessTier,
    subscriptionTier: accessTier >= 2 ? 'academic' : 'free',
    sparksMonthlyAllowance: def.sparks,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  if (def.sparks > 0) await grantMonthly(targetUid);
}

export async function applyStripeSubscription(uid: string, accessTier: AccessTier) {
  const def = tierDefinition(accessTier);
  await db().doc(`users/${uid}`).set({
    accessTier,
    subscriptionTier: accessTier >= 1 ? (accessTier >= 2 ? 'academic' : 'free') : 'free',
    sparksMonthlyAllowance: def.sparks,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  if (def.sparks > 0) {
    await db().doc(`users/${uid}`).set({ sparksGrantedAt: FieldValue.delete() }, { merge: true });
    await grantMonthly(uid);
  }
}

export async function grantPurchasedSparks(uid: string, amount: number, note: string) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new ActionError('INVALID_AMOUNT', 'Sparks amount must be a non-zero whole number.');
  }
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('USER_NOT_FOUND');
  const current = (snap.data()?.sparksBalance as number) ?? 0;
  const delta = amount < 0 ? Math.max(amount, -current) : amount;
  if (delta === 0) return { balance: current };
  const balance = await addSparks(uid, delta, amount > 0 ? 'purchase' : 'refund', note);
  return { balance };
}

export async function sendNotification(userId: string, title: string, message: string, link = '/dashboard') {
  await db().collection('notifications').add({
    userId,
    title,
    message,
    type: 'general',
    link,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function enrollFromPayment(opts: {
  studentId: string;
  courseId: string;
  amount?: number;
  currency?: string;
  paymentIntentId?: string;
  description?: string;
  /** The unified checkout writes its own SST invoice. */
  skipInvoice?: boolean;
}) {
  const { studentId, courseId } = opts;
  const user = await db().doc(`users/${studentId}`).get();
  const course = await loadCourse(courseId);
  const name = (user.data()?.name as string) ?? 'Student';
  const enrollRef = db().doc(`courses/${courseId}/enrollments/${studentId}`);
  const existing = await enrollRef.get();
  if (!existing.exists) {
    await enrollRef.set({
      studentId,
      courseId,
      studentName: name,
      progress: 0,
      completedLessons: [],
      enrolledAt: FieldValue.serverTimestamp(),
      source: 'stripe',
    });
    await db().doc(`courses/${courseId}`).set({
      enrollmentCount: FieldValue.increment(1),
    }, { merge: true });
  }
  const ownerId = (course.ownerId as string) ?? 'platform';
  if (!opts.skipInvoice) {
    await db().collection('invoices').add({
      studentId,
      studentName: name,
      courseId,
      description: opts.description ?? `Course purchase: ${(course.title as string) ?? 'Course'}`,
      amount: opts.amount ?? (course.price as number) ?? 0,
      currency: opts.currency ?? (course.currency as string) ?? 'USD',
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      stripePaymentIntentId: opts.paymentIntentId ?? null,
      createdBy: ownerId,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await db().doc(`users/${studentId}`).set({
    permissions: FieldValue.arrayUnion(`alloc:marketplace:${courseId}`),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

interface QuizRow {
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  objectiveCode?: string;
  sourceLessonId?: string;
}

export async function gradeQuiz(courseId: string, lessonId: string, answers: { question: string; selected: string }[]) {
  const hit = await findLesson(courseId, lessonId);
  if (!hit) throw new ActionError('NOT_FOUND', 'Lesson not found');
  const protectedOutputs = await readProtected(courseId, hit.moduleId, lessonId);
  const outputs = protectedOutputs ?? lessonContent(hit.data);
  const quiz = Array.isArray(outputs?.quiz) ? outputs.quiz as QuizRow[] : [];
  return answers.map((a) => {
    const q = quiz.find((row) => (row.question ?? '').trim() === a.question.trim());
    if (!q) return { correct: false, feedback: 'This question could not be checked.' };
    const correct = answersMatch(a.selected, q.answer, q.options ?? []);
    return {
      correct,
      feedback: correct
        ? 'Correct! Well done.'
        : `Not quite. ${q.explanation ?? ''}`.trim(),
    };
  });
}

export async function recordUnitQuiz(uid: string, body: {
  courseId: string;
  unitId: string;
  lessonId: string;
  responses: { question: string; selected: string; objectiveCode?: string; sourceLessonId?: string }[];
  timeTakenSeconds?: number;
  studentName?: string;
}) {
  const graded = await gradeQuiz(body.courseId, body.lessonId, body.responses.map((r) => ({ question: r.question, selected: r.selected })));
  const total = graded.length;
  const score = graded.filter((g) => g.correct).length;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  const course = await loadCourse(body.courseId);
  const mod = await db().doc(`courses/${body.courseId}/modules/${body.unitId}`).get();
  const threshold = (mod.data()?.masteryThreshold as number) ?? 70;
  const passed = percentage >= threshold;
  const responses = body.responses.map((r, i) => ({
    questionIndex: i,
    question: r.question,
    objectiveCode: r.objectiveCode,
    sourceLessonId: r.sourceLessonId,
    selected: r.selected,
    correct: graded[i]?.correct ?? false,
  }));
  const wrongByObjective: Record<string, number> = {};
  const review = new Set<string>();
  for (const r of responses) {
    if (r.correct) continue;
    if (r.objectiveCode) wrongByObjective[r.objectiveCode] = (wrongByObjective[r.objectiveCode] ?? 0) + 1;
    if (r.sourceLessonId) review.add(r.sourceLessonId);
  }
  let weakestObjective: string | undefined;
  let maxWrong = 0;
  for (const [code, wrong] of Object.entries(wrongByObjective)) {
    if (wrong > maxWrong) { maxWrong = wrong; weakestObjective = code; }
  }
  const prev = await db().collection('unit_quiz_attempts')
    .where('studentId', '==', uid)
    .where('lessonId', '==', body.lessonId)
    .get();
  const ref = await db().collection('unit_quiz_attempts').add({
    studentId: uid,
    studentName: body.studentName ?? '',
    courseId: body.courseId,
    unitId: body.unitId,
    lessonId: body.lessonId,
    attemptNumber: prev.size + 1,
    score,
    total,
    percentage,
    passed,
    timeTakenSeconds: body.timeTakenSeconds ?? 0,
    responses,
    ...(weakestObjective ? { weakestObjective } : {}),
    recommendedLessonIds: [...review],
    completedAt: FieldValue.serverTimestamp(),
  });
  if (passed && course.kind === 'curriculum') {
    await completeLesson(uid, body.courseId, body.lessonId, 100, false);
    await addSparks(uid, UNIT_PASS_REWARD, 'earn', 'Unit mastery quiz passed');
  }
  return {
    id: ref.id,
    studentId: uid,
    courseId: body.courseId,
    unitId: body.unitId,
    lessonId: body.lessonId,
    attemptNumber: prev.size + 1,
    score,
    total,
    percentage,
    passed,
    weakestObjective,
    recommendedLessonIds: [...review],
    responses,
  };
}

function presentOutputs(outputs: Record<string, unknown> | undefined, allowed: Set<string>) {
  if (!outputs) return {};
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = outputs[key];
    if (value == null) continue;
    if (key === 'quiz' && Array.isArray(value)) {
      out.quiz = value.map((row) => {
        const q = row as QuizRow;
        return {
          question: q.question,
          options: q.options ?? [],
          objectiveCode: q.objectiveCode,
          sourceLessonId: q.sourceLessonId,
        };
      });
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function lessonContentFor(uid: string, courseId: string, lessonId: string) {
  const user = await db().doc(`users/${uid}`).get();
  const role = user.data()?.role as string | undefined;
  const course = await loadCourse(courseId);
  const hit = await findLesson(courseId, lessonId);
  if (!hit) throw new ActionError('NOT_FOUND', 'Lesson not found');
  const protectedOutputs = await readProtected(courseId, hit.moduleId, lessonId);
  const outputs = protectedOutputs ?? lessonContent(hit.data);
  const formats = Object.keys(FORMAT_COSTS).filter((key) => {
    const value = outputs?.[key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
  const isStaff = role === 'admin' || role === 'teacher' || role === 'institution_admin' || course.ownerId === uid;
  const lessons = publishedFlat(course, await listLessons(courseId));
  const index = lessons.findIndex((l) => l.id === lessonId);
  const waived = !isStaff && course.kind === 'curriculum' && index >= 0 && index < freePreviewCount(course);
  const enroll = await db().doc(`courses/${courseId}/enrollments/${uid}`).get();
  const unlocked = ((enroll.data()?.unlockedFormats as Record<string, string[]> | undefined)?.[lessonId]) ?? [];
  const allowed = new Set<string>(isStaff || waived ? formats : formats.filter((f) => unlocked.includes(f)));
  if (outputs?.summary && (isStaff || waived || unlocked.includes('text'))) allowed.add('summary');
  return {
    formats,
    unlocked: isStaff || waived ? formats : unlocked,
    waived: isStaff || waived,
    balance: (user.data()?.sparksBalance as number) ?? 0,
    outputs: presentOutputs(outputs, allowed),
    title: hit.data.title ?? 'Lesson',
    status: hit.data.status ?? 'published',
  };
}

export async function courseOutlineFor(courseId: string) {
  const courseSnap = await db().doc(`courses/${courseId}`).get();
  if (!courseSnap.exists) throw new ActionError('NOT_FOUND', 'Course not found');
  const course = { id: courseSnap.id, ...courseSnap.data() };
  const lessons = await listLessons(courseId);
  const byModule = new Map<string, { id: string; title: string; order: number; status?: string; isUnitQuiz?: boolean }[]>();
  for (const lesson of lessons) {
    const list = byModule.get(lesson.moduleId) ?? [];
    list.push({
      id: lesson.id,
      title: (lesson.data.title as string) ?? 'Lesson',
      order: (lesson.data.order as number) ?? 0,
      status: lesson.data.status as string | undefined,
      isUnitQuiz: lesson.data.isUnitQuiz === true,
    });
    byModule.set(lesson.moduleId, list);
  }
  const modules = await db().collection(`courses/${courseId}/modules`).orderBy('order').get();
  return {
    course,
    modules: modules.docs.map((m) => ({
      module: { id: m.id, ...m.data() },
      lessons: (byModule.get(m.id) ?? []).sort((a, b) => a.order - b.order),
    })),
  };
}

const NEUTRAL_LINK = 'If that email belongs to a student, they will be asked to approve. Their name stays hidden until they say yes.';

export async function requestParentLink(parentId: string, parentName: string, studentEmail: string) {
  const email = studentEmail.trim().toLowerCase();
  const existing = await db().collection('parent_links')
    .where('parentId', '==', parentId)
    .where('studentEmail', '==', email)
    .limit(1)
    .get();
  if (!existing.empty) return { message: NEUTRAL_LINK };
  const student = await db().collection('users').where('email', '==', email).limit(1).get();
  const studentDoc = student.docs[0];
  if (!studentDoc || studentDoc.data().role !== 'student') return { message: NEUTRAL_LINK };
  await db().collection('parent_links').add({
    parentId,
    parentName,
    studentEmail: email,
    studentId: studentDoc.id,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });
  await db().collection('notifications').add({
    userId: studentDoc.id,
    title: 'A parent wants to link to your account',
    message: `${parentName} asked to follow your learning. Approve this on your dashboard if you know them.`,
    type: 'general',
    link: '/dashboard/student',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { message: NEUTRAL_LINK };
}

export async function respondParentLink(studentUid: string, studentEmail: string | undefined, linkId: string, approve: boolean) {
  const ref = db().doc(`parent_links/${linkId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'That request was not found.');
  const data = snap.data() ?? {};
  const email = (studentEmail ?? '').toLowerCase();
  if (data.studentId !== studentUid && data.studentEmail !== email) throw new ActionError('FORBIDDEN');
  if (data.status !== 'pending') return { status: data.status };
  if (!approve) {
    await ref.update({ status: 'rejected' });
    return { status: 'rejected' };
  }
  await ref.update({ status: 'approved', studentId: studentUid, approvedAt: FieldValue.serverTimestamp() });
  await db().doc(`users/${data.parentId as string}`).set({
    childIds: FieldValue.arrayUnion(studentUid),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const student = await db().doc(`users/${studentUid}`).get();
  const studentName = (student.data()?.name as string) ?? 'Student';
  const parent = await db().doc(`users/${data.parentId as string}`).get();
  const parentName = (parent.data()?.name as string) ?? (data.parentName as string) ?? 'Parent';
  const enrollments = await db().collectionGroup('enrollments').where('studentId', '==', studentUid).get();
  await Promise.all(enrollments.docs.map((d) => d.ref.set({
    studentName,
    parentContacts: FieldValue.arrayUnion({ id: data.parentId, name: parentName }),
  }, { merge: true })));
  await db().collection('notifications').add({
    userId: data.parentId,
    title: 'Your child approved the link',
    message: 'You can now see their progress from your dashboard.',
    type: 'general',
    link: '/dashboard/parent',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { status: 'approved' };
}

export async function unlinkChild(parentId: string, childId: string) {
  await db().doc(`users/${parentId}`).set({
    childIds: FieldValue.arrayRemove(childId),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function syncPublicProfile(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) return;
  const data = snap.data() ?? {};
  await writePublicXp(uid, (data.name as string) ?? '', (data.xp as number) ?? 0, (data.role as string) ?? 'student');
  if (isAgeTier(data.ageTier)) {
    await db().doc(`public_profiles/${uid}`).set({ ageTier: data.ageTier }, { merge: true });
  }
}

export async function messageContacts(uid: string, role: string) {
  const contacts = new Map<string, { id: string; name: string; role: string }>();
  const admins = await db().collection('public_profiles').where('role', '==', 'admin').limit(20).get();
  admins.docs.forEach((d) => {
    if (d.id !== uid) contacts.set(d.id, { id: d.id, name: (d.data().displayName as string) || 'Admin', role: 'admin' });
  });

  if (role === 'teacher' || role === 'admin') {
    const courses = await db().collection('courses').where('ownerId', '==', uid).get();
    for (const course of courses.docs) {
      const enrollments = await course.ref.collection('enrollments').get();
      enrollments.docs.forEach((e) => {
        const data = e.data();
        contacts.set(e.id, { id: e.id, name: (data.studentName as string) || 'Student', role: 'student' });
        const parents = Array.isArray(data.parentContacts) ? data.parentContacts as { id: string; name: string }[] : [];
        parents.forEach((p) => {
          if (p?.id) contacts.set(p.id, { id: p.id, name: p.name || 'Parent', role: 'parent' });
        });
      });
    }
  }

  if (role === 'parent') {
    const parent = await db().doc(`users/${uid}`).get();
    const childIds: string[] = Array.isArray(parent.data()?.childIds) ? parent.data()!.childIds as string[] : [];
    for (const childId of childIds) {
      const enrollments = await db().collectionGroup('enrollments').where('studentId', '==', childId).get();
      for (const e of enrollments.docs) {
        const courseRef = e.ref.parent.parent;
        if (!courseRef) continue;
        const course = await courseRef.get();
        const ownerId = course.data()?.ownerId as string | undefined;
        if (ownerId && ownerId !== uid) {
          contacts.set(ownerId, { id: ownerId, name: (course.data()?.ownerName as string) || 'Teacher', role: 'teacher' });
        }
      }
    }
  }

  if (role === 'student') {
    const enrollments = await db().collectionGroup('enrollments').where('studentId', '==', uid).get();
    for (const e of enrollments.docs) {
      const courseRef = e.ref.parent.parent;
      if (!courseRef) continue;
      const course = await courseRef.get();
      const ownerId = course.data()?.ownerId as string | undefined;
      if (ownerId && ownerId !== uid) {
        contacts.set(ownerId, { id: ownerId, name: (course.data()?.ownerName as string) || 'Teacher', role: 'teacher' });
      }
    }
  }

  const meSnap = await db().doc(`users/${uid}`).get();
  const meProfile = await db().doc(`community_profiles/${uid}`).get();
  const me = {
    id: uid,
    role,
    ageTier: asAgeTier(meSnap.data()?.ageTier),
    adultDmOptIn: meProfile.data()?.adultDmOptIn === true,
  };
  const allowed: { id: string; name: string; role: string }[] = [];
  for (const contact of contacts.values()) {
    const themSnap = await db().doc(`users/${contact.id}`).get();
    const themProfile = await db().doc(`community_profiles/${contact.id}`).get();
    const them = {
      id: contact.id,
      role: (themSnap.data()?.role as string) || contact.role,
      ageTier: asAgeTier(themSnap.data()?.ageTier),
      adultDmOptIn: themProfile.data()?.adultDmOptIn === true,
    };
    if (canDirectMessage(me, them).ok) allowed.push(contact);
  }
  return allowed;
}

export async function parentOverview(parentId: string, childId: string) {
  const parent = await db().doc(`users/${parentId}`).get();
  if (!hasAccountRole(parent.data(), 'parent')) throw new ActionError('FORBIDDEN', 'Parent access is required.');
  const childIds: string[] = Array.isArray(parent.data()?.childIds) ? parent.data()!.childIds as string[] : [];
  if (!childIds.includes(childId)) throw new ActionError('FORBIDDEN', 'That student has not approved this link.');
  const child = await db().doc(`users/${childId}`).get();
  const enrollments = await db().collectionGroup('enrollments').where('studentId', '==', childId).get();
  const courses = await Promise.all(enrollments.docs.map(async (e) => {
    const courseRef = e.ref.parent.parent;
    const course = courseRef ? await courseRef.get() : null;
    const data = e.data();
    return {
      courseId: courseRef?.id ?? data.courseId,
      title: (course?.data()?.title as string) ?? 'Course',
      subject: (course?.data()?.subject as string) ?? '',
      progress: (data.progress as number) ?? 0,
      completedLessons: Array.isArray(data.completedLessons) ? data.completedLessons.length : 0,
    };
  }));
  const [quizzes, grades, attendance, behaviour, assignments, invoices] = await Promise.all([
    db().collection('unit_quiz_attempts').where('studentId', '==', childId).limit(20).get(),
    db().collection('grades').where('studentId', '==', childId).limit(30).get(),
    db().collection('attendance_records').where('studentIds', 'array-contains', childId).limit(30).get(),
    db().collection('behaviour_records').where('studentId', '==', childId).limit(20).get(),
    db().collection('assignment_submissions').where('studentId', '==', childId).limit(20).get(),
    db().collection('invoices').where('studentId', '==', childId).limit(30).get(),
  ]);
  const slim = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    child: { id: childId, name: (child.data()?.name as string) ?? 'Student' },
    courses,
    quizzes: slim(quizzes.docs),
    grades: slim(grades.docs),
    attendance: slim(attendance.docs),
    behaviour: slim(behaviour.docs),
    assignments: slim(assignments.docs),
    invoices: slim(invoices.docs),
  };
}

/** A teacher may see a student's first name only when that student is in one of their classes. */
export async function lookupEnrolledStudent(teacherId: string, email: string) {
  const teacher = await db().doc(`users/${teacherId}`).get();
  const teacherRole = teacher.data()?.role;
  if (!hasAccountRole(teacher.data(), 'teacher') && teacherRole !== 'admin' && teacherRole !== 'institution_admin') {
    throw new ActionError('FORBIDDEN', 'Teaching access is required.');
  }
  const needle = email.trim().toLowerCase();
  const courses = await db().collection('courses').where('ownerId', '==', teacherId).get();
  for (const course of courses.docs) {
    const enrollments = await course.ref.collection('enrollments').get();
    for (const e of enrollments.docs) {
      const user = await db().doc(`users/${e.id}`).get();
      if ((user.data()?.email as string | undefined)?.toLowerCase() === needle) {
        return { id: e.id, name: (e.data().studentName as string) || publicDisplayName((user.data()?.name as string) ?? 'Student') };
      }
    }
  }
  return { id: null, name: null, message: 'No student in your classes uses that email.' };
}

export function tierFromId(id: string): AccessTier | null {
  const found = [0, 1, 2, 3, 4, 5, 6].map((n) => tierDefinition(n as AccessTier)).find((t) => t.id === id);
  return found ? found.tier : null;
}

export { accessTierFor };
