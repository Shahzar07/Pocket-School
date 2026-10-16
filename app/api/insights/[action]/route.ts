import { NextRequest } from 'next/server';
import { roleForServerCheck } from '@/lib/admin-access';
import { adminDb } from '@/lib/firebase-admin';
import { runPost } from '@/lib/server/http';
import type { AuthedUser } from '@/lib/api-guard';
import { ActionError, grantGoalSparks } from '@/lib/server/actions';
import { notifyParents, notifyUser, parentIdsFor } from '@/lib/server/device-push';
import { writeStudentSnapshot } from '@/lib/server/insights-jobs';
import { sparksForGoal, computeGoalStreak } from '@/lib/insights/goals';
import { tagBloom } from '@/lib/insights/analytics';
import { extractDatesFromText } from '@/lib/insights/calendar';
import { buildIntegrityCase, aiVariantPrompt, vivaQuestions, aiLikelihoodSignal, tokenSimilarity, classifierPrompt, parseClassifierScore, type IntegritySignals } from '@/lib/insights/integrity';
import { equivalentVariant, vivaSet, compareReexam, proctorLite } from '@/lib/insights/reexam';
import { buildConcerns, DEFAULT_NOTIFY_SETTINGS, inQuietHours, planDelivery, type NotifyRole } from '@/lib/insights/concerns';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function quietNow(userId: string): Promise<boolean> {
  const snap = await adminDb().doc(`notify_settings/${userId}`).get();
  const data = snap.data() ?? {};
  const start = typeof data.quietStart === 'string' ? data.quietStart : DEFAULT_NOTIFY_SETTINGS.quietStart;
  const end = typeof data.quietEnd === 'string' ? data.quietEnd : DEFAULT_NOTIFY_SETTINGS.quietEnd;
  return inQuietHours(new Date(), start, end);
}

async function assertCanSeeStudent(user: AuthedUser, studentId: string) {
  if (user.uid === studentId) return;
  const actor = await adminDb().doc(`users/${user.uid}`).get();
  const stored = actor.data()?.role as string | undefined;
  const role = roleForServerCheck(user, stored);
  const children = (actor.data()?.childIds as string[] | undefined) ?? [];
  if (role === 'admin' || role === 'institution_admin') return;
  if (role === 'parent' && children.includes(studentId)) return;
  throw new ActionError('FORBIDDEN', 'You cannot open that student.');
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'goal-event') {
      const goalId = str(body.goalId);
      const kind = str(body.kind);
      const goal = await adminDb().doc(`daily_goals/${goalId}`).get();
      if (!goal.exists || goal.data()?.studentId !== user.uid) throw new ActionError('FORBIDDEN', 'That goal belongs to someone else.');
      const data = goal.data() ?? {};
      const name = (data.studentName as string) || 'Your child';
      const title = (data.title as string) || 'A goal';
      const copy: Record<string, { title: string; message: string; pref: 'goals' | 'focus' | 'streaks' }> = {
        created: { title: `${name} set a goal`, message: `"${title}" was added.`, pref: 'goals' },
        achieved: { title: `${name} achieved a goal`, message: `"${title}" is complete.`, pref: 'goals' },
        focus: { title: `${name} finished a focus session`, message: `Focus time was logged on "${title}".`, pref: 'focus' },
        missed: { title: `${name} missed a goal`, message: `"${title}" was not finished.`, pref: 'goals' },
        streak_break: { title: `${name}'s goal streak broke`, message: `The streak on "${title}" stopped.`, pref: 'streaks' },
      };
      const note = copy[kind];
      if (!note) throw new ActionError('BAD_KIND', 'Unknown goal event.');
      const parents = await notifyParents(user.uid, name, { ...note, type: 'general', link: '/dashboard/parent/goals' });
      return { parents };
    }

    if (action === 'award-goal') {
      const goalId = str(body.goalId);
      const goal = await adminDb().doc(`daily_goals/${goalId}`).get();
      if (!goal.exists || goal.data()?.studentId !== user.uid) throw new ActionError('FORBIDDEN', 'That goal belongs to someone else.');
      const data = goal.data() ?? {};
      const all = await adminDb().collection('daily_goals').where('studentId', '==', user.uid).limit(200).get();
      const streak = computeGoalStreak(all.docs.map(doc => ({
        dateKey: (doc.data().dateKey as string) ?? '',
        status: (doc.data().status as string) ?? '',
      })));
      const amount = sparksForGoal(
        {
          status: (data.status as string) ?? '',
          dateKey: (data.dateKey as string) ?? '',
          deadline: data.deadline as string | undefined,
          sparksBonus: typeof data.sparksBonus === 'number' ? data.sparksBonus : undefined,
        },
        new Date(),
        streak,
      );
      if (amount <= 0) return { granted: false, amount: 0 };
      return grantGoalSparks(user.uid, goalId, amount, `Goal bonus: ${data.title ?? 'goal'}`);
    }

    if (action === 'refresh-snapshot') {
      const studentId = str(body.studentId) || user.uid;
      await assertCanSeeStudent(user, studentId);
      const snapshot = await writeStudentSnapshot(studentId);
      return { snapshot };
    }

    if (action === 'bloom-tag') {
      const text = str(body.text).slice(0, 4000);
      const heuristic = tagBloom(text);
      if (!process.env.OPENROUTER_API_KEY || body.useAi !== true) return { level: heuristic, source: 'heuristic' };
      try {
        const raw = await callOpenRouter([
          { role: 'system', content: 'Reply with one Bloom level only: remember, understand, apply, analyse, evaluate, or create.' },
          { role: 'user', content: text },
        ], { model: SMART_MODEL, temperature: 0 });
        const level = raw.trim().toLowerCase();
        const allowed = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];
        return { level: allowed.includes(level) ? level : heuristic, source: 'ai' };
      } catch {
        return { level: heuristic, source: 'heuristic' };
      }
    }

    if (action === 'calendar-extract') {
      const text = str(body.text).slice(0, 20000);
      const drafts = extractDatesFromText(text);
      return { drafts, needsReview: true };
    }

    if (action === 'integrity-notify') {
      const caseId = str(body.caseId);
      const snap = await adminDb().doc(`integrity_cases/${caseId}`).get();
      if (!snap.exists) throw new ActionError('NOT_FOUND', 'Case not found.');
      const data = snap.data() ?? {};
      if (data.teacherId !== user.uid) {
        const actor = await adminDb().doc(`users/${user.uid}`).get();
        const role = roleForServerCheck(user, actor.data()?.role as string | undefined);
        if (role !== 'admin' && role !== 'institution_admin') {
          throw new ActionError('FORBIDDEN', 'Only the teacher on the case can notify.');
        }
      }
      const assignment = str(data.assignmentTitle) || 'an assignment';
      const teacherId = str(data.teacherId);
      await notifyUser({
        userId: teacherId,
        title: 'Integrity case opened',
        message: `A review is open for ${assignment}. No mark changes until a teacher decides.`,
        type: 'integrity',
        link: '/dashboard/teacher/integrity/cases',
        pref: 'integrity',
        skipPush: await quietNow(teacherId),
      });
      const parentIds = await parentIdsFor(str(data.studentId));
      await Promise.all(parentIds.map(async parentId => notifyUser({
        userId: parentId,
        title: 'Integrity review opened',
        message: `A teacher opened a review for ${assignment}. Nothing is marked down automatically.`,
        type: 'integrity',
        link: '/dashboard/parent/integrity',
        pref: 'integrity',
        skipPush: await quietNow(parentId),
      })));
      return { parents: parentIds.length };
    }

    if (action === 'integrity-flag') {
      const studentId = str(body.studentId) || user.uid;
      if (studentId !== user.uid) {
        const actor = await adminDb().doc(`users/${user.uid}`).get();
        const role = roleForServerCheck(user, actor.data()?.role as string | undefined);
        if (role !== 'teacher' && role !== 'admin' && role !== 'institution_admin') {
          throw new ActionError('FORBIDDEN', 'You cannot open a flag for that student.');
        }
      }
      let aiLikelihood = num(body.aiLikelihood);
      const submission = str(body.submission).slice(0, 8000);
      if (body.useAi === true && submission && process.env.OPENROUTER_API_KEY) {
        try {
          const raw = await callOpenRouter([
            { role: 'system', content: 'Reply with one integer from 0 to 100.' },
            { role: 'user', content: classifierPrompt(submission) },
          ], { model: SMART_MODEL, temperature: 0 });
          aiLikelihood = parseClassifierScore(raw) ?? aiLikelihoodSignal(submission);
        } catch {
          aiLikelihood = aiLikelihood ?? (submission ? aiLikelihoodSignal(submission) : undefined);
        }
      } else if (aiLikelihood == null && submission) {
        aiLikelihood = aiLikelihoodSignal(submission);
      }
      const signals: IntegritySignals = {
        pasteEvents: num(body.pasteEvents),
        largeInsertChars: num(body.largeInsertChars),
        typingCadenceCv: num(body.typingCadenceCv),
        secondsToAnswer: num(body.secondsToAnswer),
        baselineSeconds: num(body.baselineSeconds),
        focusLosses: num(body.focusLosses),
        styleShift: num(body.styleShift),
        aiLikelihood,
        similarity: num(body.similarity) ?? (submission && str(body.comparison) ? tokenSimilarity(submission, str(body.comparison)) : undefined),
        matchSource: body.matchSource === 'ai_studio' || body.matchSource === 'classmate' ? body.matchSource : 'none',
        identicalWrongCount: num(body.identicalWrongCount),
      };
      const draft = buildIntegrityCase({ assignmentTitle: str(body.assignmentTitle) || 'Submission', signals });
      if (draft.level === 'clear') return { opened: false, ...draft };
      const teacherId = str(body.teacherId);
      const ref = await adminDb().collection('integrity_cases').add({
        studentId,
        studentName: str(body.studentName) || 'Student',
        teacherId,
        teacherName: str(body.teacherName) || 'Teacher',
        assignmentTitle: str(body.assignmentTitle) || 'Submission',
        ...draft,
        decision: 'pending',
        automaticPenalty: false,
        createdAt: new Date().toISOString(),
      });
      await adminDb().doc(`integrity_cases/${ref.id}/audit/opened`).set({
        at: new Date().toISOString(),
        actorId: user.uid,
        actorName: str(body.actorName) || 'Poket School',
        action: 'opened',
      });
      if (teacherId) {
        await notifyUser({
          userId: teacherId,
          title: 'Integrity flag needs a look',
          message: `${str(body.assignmentTitle) || 'A submission'} has signals for review. No mark has changed.`,
          type: 'integrity',
          link: '/dashboard/teacher/integrity/cases',
          pref: 'integrity',
          skipPush: await quietNow(teacherId),
        });
      }
      const parentIds = await parentIdsFor(studentId);
      await Promise.all(parentIds.map(async parentId => notifyUser({
        userId: parentId,
        title: 'Integrity flag needs a look',
        message: 'A check on your child’s work needs a teacher. Nothing is marked down automatically.',
        type: 'integrity',
        link: '/dashboard/parent/integrity',
        pref: 'integrity',
        skipPush: await quietNow(parentId),
      })));
      return { opened: true, caseId: ref.id, ...draft };
    }

    if (action === 'concern-notify') {
      const studentId = str(body.studentId);
      await assertCanSeeStudent(user, studentId);
      const actor = await adminDb().doc(`users/${user.uid}`).get();
      const role = roleForServerCheck(user, actor.data()?.role as string | undefined);
      if (role !== 'teacher' && role !== 'admin' && role !== 'institution_admin') {
        throw new ActionError('FORBIDDEN', 'Only staff can send a concern flag.');
      }
      const flags = buildConcerns({
        atRisk: body.atRisk === true,
        studyMinutes: num(body.studyMinutes),
        previousStudyMinutes: num(body.previousStudyMinutes),
        missedGoals: num(body.missedGoals),
        attendanceRate: num(body.attendanceRate) ?? null,
        absenceRun: num(body.absenceRun),
        mood: num(body.mood) ?? null,
      });
      const institutionId = str(body.institutionId);
      for (const flag of flags) {
        if (role === 'institution_admin' && !flag.notify.includes('institution')) continue;
        await adminDb().collection('concern_flags').add({
          ...flag,
          studentId,
          teacherId: role === 'teacher' ? user.uid : str(body.teacherId),
          institutionId,
          automaticPenalty: false,
          createdAt: new Date().toISOString(),
        });
        const recipients: { id: string; role: NotifyRole }[] = [];
        if (flag.notify.includes('teacher') && str(body.teacherId)) recipients.push({ id: str(body.teacherId), role: 'teacher' });
        if (flag.notify.includes('student')) recipients.push({ id: studentId, role: 'student' });
        if (flag.notify.includes('parent')) {
          for (const parentId of await parentIdsFor(studentId)) recipients.push({ id: parentId, role: 'parent' });
        }
        for (const recipient of recipients) {
          const settings = { ...DEFAULT_NOTIFY_SETTINGS };
          const snap = await adminDb().doc(`notify_settings/${recipient.id}`).get();
          if (typeof snap.data()?.quietStart === 'string') settings.quietStart = snap.data()?.quietStart as string;
          if (typeof snap.data()?.quietEnd === 'string') settings.quietEnd = snap.data()?.quietEnd as string;
          const plan = planDelivery(flag, recipient.role, settings, new Date());
          if (!plan.inApp) continue;
          await notifyUser({
            userId: recipient.id,
            title: flag.title,
            message: flag.detail,
            type: 'general',
            link: recipient.role === 'parent' ? '/dashboard/parent/integrity' : '/dashboard/teacher/integrity/cases',
            pref: 'integrity',
            skipPush: !plan.push,
          });
        }
      }
      return { flags: flags.length };
    }

    if (action === 'report-notify') {
      const studentId = str(body.studentId);
      const actor = await adminDb().doc(`users/${user.uid}`).get();
      const role = roleForServerCheck(user, actor.data()?.role as string | undefined);
      if (role !== 'teacher' && role !== 'admin' && role !== 'institution_admin') {
        throw new ActionError('FORBIDDEN', 'Only staff can publish a report card.');
      }
      const parentIds = await parentIdsFor(studentId);
      await Promise.all(parentIds.map(async parentId => notifyUser({
        userId: parentId,
        title: 'A report card is ready',
        message: `${str(body.studentName) || 'Your child'} has a new report card to read and sign.`,
        type: 'grade',
        link: '/dashboard/parent/reports',
        pref: 'reports',
        skipPush: await quietNow(parentId),
      })));
      return { parents: parentIds.length };
    }

    if (action === 'integrity-draft') {
      const submission = str(body.submission).slice(0, 8000);
      const comparison = str(body.comparison).slice(0, 8000);
      const draft = buildIntegrityCase({
        assignmentTitle: str(body.assignmentTitle) || 'Submission',
        signals: {
          pasteEvents: Number(body.pasteEvents) || 0,
          largeInsertChars: num(body.largeInsertChars),
          typingCadenceCv: body.typingCadenceCv == null ? undefined : Number(body.typingCadenceCv),
          secondsToAnswer: num(body.secondsToAnswer),
          baselineSeconds: num(body.baselineSeconds),
          focusLosses: Number(body.focusLosses) || 0,
          styleShift: body.styleShift == null ? undefined : Number(body.styleShift),
          aiLikelihood: submission ? aiLikelihoodSignal(submission) : num(body.aiLikelihood),
          similarity: submission && comparison ? tokenSimilarity(submission, comparison) : num(body.similarity),
          matchSource: body.matchSource === 'ai_studio' || body.matchSource === 'classmate' ? body.matchSource : undefined,
          identicalWrongCount: num(body.identicalWrongCount),
        },
      });
      const topic = str(body.topic) || str(body.assignmentTitle) || 'this work';
      const bloom = str(body.bloom) || 'understand';
      const variant = equivalentVariant({
        title: str(body.assignmentTitle) || topic,
        topic,
        bloom,
        originalPrompts: Array.isArray(body.originalPrompts) ? body.originalPrompts.filter((item): item is string => typeof item === 'string') : [],
      });
      return {
        ...draft,
        viva: vivaSet(topic, bloom).concat(vivaQuestions(str(body.assignmentTitle) || 'this work')).slice(0, 3),
        variant: variant.note,
        questions: variant.questions,
        proctor: proctorLite(num(body.timerMinutes) ?? 25),
        comparison: str(body.resitText)
          ? compareReexam({
            originalText: submission,
            resitText: str(body.resitText),
            originalScore: num(body.originalScore),
            resitScore: num(body.resitScore),
            vivaAnswered: num(body.vivaAnswered) ?? 0,
            vivaCount: num(body.vivaCount) ?? 3,
          })
          : null,
        legacyVariant: aiVariantPrompt(str(body.assignmentTitle) || 'this work'),
      };
    }

    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
