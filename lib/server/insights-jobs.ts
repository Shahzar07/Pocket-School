/**
 * Scheduled work: missed-goal alerts, streak breaks, the Monday digest,
 * and due report schedules. Aggregates for a person are built with
 * buildSnapshot when a screen asks; this job stores the ones it can see
 * from yesterday's goals so the freshness time is real.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { buildSnapshot } from '../insights/aggregate';
import type { AttendanceMark } from '../insights/attendance';
import type { QuizPoint, StudyEvent } from '../insights/analytics';
import { digestHeadlines } from '../insights/analytics';
import { formatProgressDigest, type GoalLike } from '../insights/goals';
import { digestDue, type DigestCadence } from '../parent-controls';
import { addDays, isoDateKey } from '../insights/dates';
import { behaviourAlertMessages, buildBehaviourBoard } from '../insights/behaviour-board';
import type { Mood } from '../insights/behaviour';
import { notifyParents, notifyUser } from './device-push';

function yesterdayKey(now = new Date()): string {
  return addDays(isoDateKey(now), -1);
}

export async function runMissedGoalAlerts(now = new Date()): Promise<{ checked: number; notified: number }> {
  const key = yesterdayKey(now);
  const snap = await adminDb().collection('daily_goals').where('dateKey', '==', key).limit(500).get();
  let notified = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const status = data.status as string;
    if (status === 'completed' || status === 'excused' || data.notifiedMissed === true) continue;
    const studentId = data.studentId as string;
    const name = (data.studentName as string) || 'Your child';
    await notifyParents(studentId, name, {
      title: `${name} missed a goal`,
      message: `"${data.title ?? 'A goal'}" was still open at the end of ${key}.`,
      type: 'general',
      link: '/dashboard/parent/goals',
      pref: 'goals',
    });
    await doc.ref.update({ notifiedMissed: true, status: status === 'in_progress' || status === 'not_started' ? 'overdue' : status });
    notified += 1;

    const prior = await adminDb().collection('daily_goals').where('studentId', '==', studentId).limit(40).get();
    const dayBefore = addDays(key, -1);
    const priorDay = prior.docs.filter(row => row.data().dateKey === dayBefore);
    const held = priorDay.length > 0 && priorDay.every(row => {
      const s = row.data().status as string;
      return s === 'completed' || s === 'excused';
    });
    if (held && data.notifiedStreakBreak !== true) {
      await notifyParents(studentId, name, {
        title: `${name}'s goal streak broke`,
        message: `The streak stopped on ${key}.`,
        type: 'general',
        link: '/dashboard/parent/goals',
        pref: 'streaks',
      });
      await doc.ref.update({ notifiedStreakBreak: true });
    }
  }
  return { checked: snap.size, notified };
}

export async function runWeeklyDigest(now = new Date()): Promise<{ parents: number }> {
  const end = yesterdayKey(now);
  const start = addDays(end, -6);
  const snap = await adminDb().collection('daily_goals').where('dateKey', '>=', start).where('dateKey', '<=', end).limit(800).get();
  const byStudent = new Map<string, { name: string; goals: Record<string, unknown>[] }>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const id = data.studentId as string;
    const row = byStudent.get(id) ?? { name: (data.studentName as string) || 'Your child', goals: [] };
    row.goals.push(data);
    byStudent.set(id, row);
  }
  const sent = new Set<string>();
  for (const [studentId, row] of byStudent) {
    const parents = await adminDb().collection('users').where('childIds', 'array-contains', studentId).get();
    for (const parent of parents.docs) {
      const controls = await adminDb().doc(`users/${parent.id}/child_controls/${studentId}`).get();
      const cadence = (controls.data()?.digestCadence as DigestCadence | undefined) ?? 'weekly';
      if (!digestDue(cadence, now)) continue;
      const windowStart = cadence === 'daily' ? end : start;
      const slice = row.goals.filter(goal => {
        const key = goal.dateKey as string;
        return key >= windowStart && key <= end;
      });
      const minutes = slice.reduce((sum, goal) => sum + (Number(goal.focusMinutes) || Number(goal.actualMinutes) || 0), 0);
      const lessons = slice.reduce((sum, goal) => sum + (Array.isArray(goal.completedLessonIds) ? goal.completedLessonIds.length : 0), 0);
      const quizScores = slice.flatMap(goal => typeof goal.quizScore === 'number' ? [goal.quizScore] : []);
      const goalsMet = slice.filter(goal => goal.status === 'completed').length;
      const stored = await adminDb().doc(`analytics_snapshots/student_${studentId}`).get();
      const headlines = digestHeadlines((stored.data()?.metrics ?? {}) as Record<string, number | null | undefined>);
      await notifyUser({
        userId: parent.id,
        title: cadence === 'daily' ? 'Daily learning digest' : 'Weekly learning digest',
        message: formatProgressDigest({
          childName: row.name,
          minutes,
          lessons,
          quizScores,
          goalsMet,
          goalsSet: slice.length,
        }) + headlines,
        type: 'general',
        link: '/dashboard/parent/goals',
        pref: 'digest',
      });
      sent.add(`${parent.id}:${studentId}`);
    }
  }
  return { parents: sent.size };
}

function millis(value: unknown): number | undefined {
  const ts = value as { toMillis?: () => number } | undefined;
  return ts?.toMillis?.();
}

async function sparksSpentFor(studentId: string): Promise<number> {
  try {
    const tx = await adminDb().collection(`users/${studentId}/spark_transactions`).limit(80).get();
    return tx.docs.reduce((sum, row) => {
      const amount = Number(row.data().amount) || 0;
      return row.data().type === 'spend' || amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
  } catch {
    return 0;
  }
}

async function teacherIdsFor(studentId: string): Promise<string[]> {
  try {
    const enrolled = await adminDb().collectionGroup('enrollments').where('studentId', '==', studentId).limit(20).get();
    const ids = new Set<string>();
    for (const row of enrolled.docs) {
      const courseId = row.ref.parent.parent?.id;
      if (!courseId) continue;
      const course = await adminDb().doc(`courses/${courseId}`).get();
      const owner = course.data()?.ownerId;
      if (typeof owner === 'string' && owner) ids.add(owner);
    }
    return [...ids];
  } catch (error) {
    console.error('Teacher ids for analytics', error);
    return [];
  }
}

/** Store one student's aggregate. Screens read this and show computedAt. */
export async function writeStudentSnapshot(studentId: string, now = new Date()) {
  const db = adminDb();
  const end = isoDateKey(now);
  const start = addDays(end, -27);
  const [goalsSnap, studySnap, focusSnap, quizSnap, attendanceSnap] = await Promise.all([
    db.collection('daily_goals').where('studentId', '==', studentId).limit(200).get(),
    db.collection('study_events').where('studentId', '==', studentId).limit(300).get(),
    db.collection('focus_sessions').where('studentId', '==', studentId).limit(100).get(),
    db.collection('unit_quiz_attempts').where('studentId', '==', studentId).limit(80).get(),
    db.collection('attendance').where('studentId', '==', studentId).limit(100).get(),
  ]);

  const goals: GoalLike[] = goalsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      dateKey: (data.dateKey as string) ?? '',
      title: (data.title as string) ?? '',
      status: (data.status as string) ?? 'not_started',
      deadline: data.deadline as string | undefined,
      createdAtMs: millis(data.createdAt),
      startedAtMs: millis(data.startedAt),
      estimateMinutes: data.estimateMinutes as number | undefined,
    };
  });
  const studyEvents: StudyEvent[] = studySnap.docs.map(doc => {
    const data = doc.data();
    return {
      minutes: Number(data.minutes) || 0,
      at: (data.at as string) ?? undefined,
      weekday: data.weekday as number | undefined,
      hour: data.hour as number | undefined,
      courseId: data.courseId as string | undefined,
      source: data.source as StudyEvent['source'],
    };
  });
  const quizzes: QuizPoint[] = quizSnap.docs.map(doc => {
    const data = doc.data();
    const completed = millis(data.completedAt);
    return {
      at: completed ? new Date(completed).toISOString() : end,
      score: Number(data.score) || 0,
      max: Number(data.total) || 1,
      unitId: data.unitId as string | undefined,
      lessonId: data.lessonId as string | undefined,
      topic: data.weakestObjective as string | undefined,
      correct: data.passed === true,
    };
  });
  const flat: AttendanceMark[] = attendanceSnap.docs.map(doc => {
    const data = doc.data();
    return {
      dateKey: (data.dateKey as string) ?? end,
      status: (data.status as AttendanceMark['status']) ?? 'present',
      studentId,
      courseId: data.courseId as string | undefined,
      source: (data.source as AttendanceMark['source']) ?? 'manual',
      note: data.note as string | undefined,
    };
  });
  let sessionMarks: AttendanceMark[] = [];
  try {
    const sessions = await db.collection('attendance_records').where('studentIds', 'array-contains', studentId).limit(80).get();
    sessionMarks = sessions.docs.flatMap(row => {
      const data = row.data();
      const dateKey = (data.dateKey as string) || end;
      const entries = Array.isArray(data.records) ? data.records as { studentId?: string; status?: AttendanceMark['status']; note?: string; source?: AttendanceMark['source'] }[] : [];
      return entries.filter(entry => entry.studentId === studentId).map(entry => ({
        dateKey,
        status: entry.status ?? 'present',
        studentId,
        courseId: data.courseId as string | undefined,
        source: entry.source ?? 'manual',
        note: entry.note,
      }));
    });
  } catch (error) {
    console.error('Attendance sessions unavailable', error);
  }
  const { mergeMarks } = await import('../insights/attendance');
  const attendance = mergeMarks(flat.filter(mark => mark.source === 'automatic'), [...flat.filter(mark => mark.source !== 'automatic'), ...sessionMarks]);
  const sparksEarned = goalsSnap.docs.reduce((sum, doc) => sum + (doc.data().sparksAwarded ? Number(doc.data().sparksBonus) || 0 : 0), 0);
  let holidays: string[] = [];
  try {
    const holidaySnap = await db.collection('calendar_events').where('type', '==', 'holiday').limit(200).get();
    holidays = holidaySnap.docs.map(doc => {
      const start = doc.data().startDate as { toDate?: () => Date } | undefined;
      const date = start?.toDate?.();
      return date ? date.toISOString().slice(0, 10) : '';
    }).filter(Boolean);
  } catch (error) {
    console.error('Holiday calendar unavailable', error);
  }
  const snapshot = buildSnapshot({
    scope: 'student',
    scopeId: studentId,
    computedAt: now.toISOString(),
    rangeStart: start,
    rangeEnd: end,
    studyEvents,
    quizzes,
    goals,
    attendance,
    holidays,
    focusSessions: focusSnap.docs.map(doc => ({
      plannedMinutes: Number(doc.data().plannedMinutes) || 0,
      actualMinutes: Number(doc.data().actualMinutes) || 0,
    })),
    hints: 0,
    questions: quizzes.length,
    aiTurns: 0,
    sparksEarned,
    sparksSpent: await sparksSpentFor(studentId),
    deadlinesMs: [],
    cohortScores: [],
    previousStudyMinutes: null,
    integrityOpen: false,
    streakBroken: false,
    now,
  });
  const teacherIds = await teacherIdsFor(studentId);
  const userDoc = await db.doc(`users/${studentId}`).get();
  const studentName = (userDoc.data()?.name as string) || 'Student';
  const institutionId = (userDoc.data()?.institutionId as string) || '';
  let behaviourBoard: Record<string, unknown> | null = null;
  try {
    const [moodSnap, noteSnap] = await Promise.all([
      db.collection('mood_checkins').where('studentId', '==', studentId).limit(60).get(),
      db.collection('behaviour_records').where('studentId', '==', studentId).limit(40).get(),
    ]);
    const board = buildBehaviourBoard({
      role: 'student',
      scopeLabel: studentName,
      computedAt: now.toISOString(),
      precomputed: true,
      now,
      moods: moodSnap.docs.map(row => {
        const data = row.data();
        const mood = Number(data.mood);
        return {
          dateKey: String(data.dateKey ?? ''),
          mood: (mood >= 1 && mood <= 5 ? mood : 3) as Mood,
          effort: typeof data.effort === 'number' ? data.effort : undefined,
          at: `${data.dateKey ?? end}T12:00:00.000Z`,
        };
      }),
      notes: noteSnap.docs.map(row => {
        const data = row.data();
        const created = data.createdAt as { toDate?: () => Date } | undefined;
        return {
          id: row.id,
          studentId,
          studentLabel: (data.studentName as string) || studentName,
          type: (data.type as 'merit' | 'demerit' | 'commendation' | 'warning' | 'note') || 'note',
          points: Number(data.points) || 0,
          description: (data.description as string) || '',
          at: created?.toDate?.().toISOString() ?? now.toISOString(),
        };
      }),
      focusSessions: focusSnap.docs.map(row => ({
        plannedMinutes: Number(row.data().plannedMinutes) || 0,
        actualMinutes: Number(row.data().actualMinutes) || 0,
        goalId: row.data().goalId as string | undefined,
      })),
      snapshotInput: {
        scope: 'student',
        scopeId: studentId,
        computedAt: now.toISOString(),
        rangeStart: start,
        rangeEnd: end,
        studyEvents,
        quizzes,
        goals,
        attendance,
        holidays,
        focusSessions: focusSnap.docs.map(row => ({
          plannedMinutes: Number(row.data().plannedMinutes) || 0,
          actualMinutes: Number(row.data().actualMinutes) || 0,
        })),
        hints: 0,
        questions: quizzes.length,
        aiTurns: 0,
        sparksEarned,
        sparksSpent: snapshot.metrics.sparks_spent ?? 0,
        deadlinesMs: [],
        cohortScores: [],
        previousStudyMinutes: null,
        integrityOpen: false,
        streakBroken: false,
        now,
      },
    });
    const { snapshot: _snapshot, ...rest } = board;
    behaviourBoard = rest;
  } catch (error) {
    console.error('Behaviour board', error);
  }
  const ref = db.collection('analytics_snapshots').doc(`student_${studentId}`);
  const prior = await ref.get();
  const today = isoDateKey(now);
  const alerts = behaviourAlertMessages(snapshot.behaviour.anomalies, studentName);
  let behaviourAlertedOn = prior.data()?.behaviourAlertedOn as string | undefined;
  if (alerts.length > 0 && behaviourAlertedOn !== today) {
    try {
      for (const alert of alerts) {
        await notifyParents(studentId, studentName, {
          title: alert.title,
          message: alert.message,
          type: 'general',
          link: alert.link,
          pref: 'behaviour',
        });
        await Promise.all(teacherIds.map(teacherId => notifyUser({
          userId: teacherId,
          title: alert.title,
          message: alert.message,
          type: 'general',
          link: '/dashboard/behaviour',
          pref: 'behaviour',
        })));
      }
      behaviourAlertedOn = today;
    } catch (error) {
      console.error('Behaviour alert', error);
    }
  }
  await ref.set({
    ...snapshot,
    subjectStudentId: studentId,
    teacherIds,
    ...(institutionId ? { institutionId } : {}),
    ...(behaviourBoard ? { behaviourBoard } : {}),
    ...(behaviourAlertedOn ? { behaviourAlertedOn } : {}),
    computedAt: now.toISOString(),
  });
  return snapshot;
}

export async function refreshActiveSnapshots(now = new Date()): Promise<{ students: number }> {
  const key = yesterdayKey(now);
  const snap = await adminDb().collection('daily_goals').where('dateKey', '==', key).limit(200).get();
  const ids = [...new Set(snap.docs.map(doc => doc.data().studentId as string).filter(Boolean))].slice(0, 40);
  for (const id of ids) {
    try { await writeStudentSnapshot(id, now); } catch (error) { console.error('snapshot', id, error); }
  }
  return { students: ids.length };
}

export async function runDueSchedules(now = new Date()): Promise<{ sent: number }> {
  const today = isoDateKey(now);
  const snap = await adminDb().collection('report_schedules').where('nextRun', '<=', today).limit(200).get();
  let sent = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    await notifyUser({
      userId: data.ownerId as string,
      title: 'Your scheduled report is ready',
      message: `${data.scopeLabel ?? 'Report'} · ${data.cadence ?? 'weekly'}. Open Reports to export it.`,
      type: 'general',
      link: '/dashboard/reports',
      pref: 'reports',
    });
    const { nextScheduleDate } = await import('../insights/reports');
    const cadence = data.cadence === 'daily' || data.cadence === 'term' || data.cadence === 'weekly' ? data.cadence : 'weekly';
    await doc.ref.update({
      nextRun: nextScheduleDate(cadence, today),
      lastRunAt: FieldValue.serverTimestamp(),
    });
    sent += 1;
  }
  return { sent };
}
