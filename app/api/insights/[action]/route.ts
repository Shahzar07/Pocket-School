import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { runPost } from '@/lib/server/http';
import { ActionError, grantGoalSparks } from '@/lib/server/actions';
import { notifyParents, notifyUser } from '@/lib/server/device-push';
import { writeStudentSnapshot } from '@/lib/server/insights-jobs';
import { sparksForGoal, computeGoalStreak } from '@/lib/insights/goals';
import { tagBloom } from '@/lib/insights/analytics';
import { extractDatesFromText } from '@/lib/insights/calendar';
import { buildIntegrityCase, aiVariantPrompt, vivaQuestions, aiLikelihoodSignal, tokenSimilarity } from '@/lib/insights/integrity';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function assertCanSeeStudent(actorId: string, studentId: string) {
  if (actorId === studentId) return;
  const actor = await adminDb().doc(`users/${actorId}`).get();
  const role = actor.data()?.role as string | undefined;
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
      await assertCanSeeStudent(user.uid, studentId);
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
        const role = actor.data()?.role as string | undefined;
        if (role !== 'admin' && role !== 'institution_admin') {
          throw new ActionError('FORBIDDEN', 'Only the teacher on the case can notify.');
        }
      }
      const assignment = str(data.assignmentTitle) || 'an assignment';
      await notifyUser({
        userId: data.teacherId as string,
        title: 'Integrity case opened',
        message: `A review is open for ${assignment}. No mark changes until a teacher decides.`,
        type: 'integrity',
        link: '/dashboard/teacher/integrity/cases',
        pref: 'integrity',
      });
      const parents = await notifyParents(str(data.studentId), str(data.studentName) || 'Your child', {
        title: 'Integrity review opened',
        message: `A teacher opened a review for ${assignment}. Nothing is marked down automatically.`,
        type: 'integrity',
        link: '/dashboard/student/integrity',
        pref: 'integrity',
      });
      return { parents };
    }

    if (action === 'integrity-draft') {
      const submission = str(body.submission).slice(0, 8000);
      const comparison = str(body.comparison).slice(0, 8000);
      const draft = buildIntegrityCase({
        assignmentTitle: str(body.assignmentTitle) || 'Submission',
        signals: {
          pasteEvents: Number(body.pasteEvents) || 0,
          typingCadenceCv: body.typingCadenceCv == null ? undefined : Number(body.typingCadenceCv),
          focusLosses: Number(body.focusLosses) || 0,
          styleShift: body.styleShift == null ? undefined : Number(body.styleShift),
          aiLikelihood: submission ? aiLikelihoodSignal(submission) : undefined,
          similarity: submission && comparison ? tokenSimilarity(submission, comparison) : undefined,
        },
      });
      return {
        ...draft,
        viva: vivaQuestions(str(body.assignmentTitle) || 'this work'),
        variant: aiVariantPrompt(str(body.assignmentTitle) || 'this work'),
      };
    }

    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
