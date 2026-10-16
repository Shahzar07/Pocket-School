'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getBehaviourRecordsForStudent, getChildrenProfiles, getEnrollmentsForCourse, getGradesForStudent,
  getTeacherCourses, subscribeDailyGoals, type DailyGoal,
} from '@/lib/db';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { BehaviourDashboard } from '@/components/insights/behaviour-dashboard';
import { buildBehaviourBoard, type BehaviourBoardModel, type BehaviourRole, type MoodCheck } from '@/lib/insights/behaviour-board';
import { listFocusSessions, listMoods, listStudyEvents, readSnapshot, saveMood } from '@/lib/insights/client';
import { addDays, isoDateKey } from '@/lib/insights/dates';
import type { Mood } from '@/lib/insights/behaviour';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

function reportRole(role: string | undefined): BehaviourRole {
  if (role === 'parent' || role === 'teacher' || role === 'admin' || role === 'institution_admin') {
    return role === 'admin' ? 'institution_admin' : role;
  }
  return 'student';
}

export default function BehaviourPage() {
  const { user, profile } = useAuthSTORE();
  const role = reportRole(profile?.role);
  const [childId, setChildId] = useState('');
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [board, setBoard] = useState<BehaviourBoardModel | null>(null);
  const [goals, setGoals] = useState<DailyGoal[]>([]);

  useEffect(() => {
    if (!user || role !== 'parent') return;
    getChildrenProfiles(user.uid).then(rows => {
      const list = rows.map(row => ({ id: row.id, name: row.data.name || 'Child' }));
      setChildren(list);
      setChildId(current => current || list[0]?.id || '');
    }).catch(() => setChildren([]));
  }, [user, role]);

  const subjectId = role === 'parent' ? childId : role === 'student' ? user?.uid ?? '' : '';

  useEffect(() => {
    if (!subjectId) return;
    return subscribeDailyGoals(subjectId, setGoals);
  }, [subjectId]);

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    const run = async () => {
      const end = isoDateKey();
      const start = addDays(end, -27);
      const now = new Date();
      if (role === 'student' || role === 'parent') {
        if (!subjectId) return;
        const [stored, grades, events, focus, moods, notes] = await Promise.all([
          readSnapshot(subjectId).catch(() => null),
          getGradesForStudent(subjectId).catch(() => []),
          listStudyEvents(subjectId).catch(() => []),
          listFocusSessions(subjectId).catch(() => []),
          listMoods(subjectId).catch(() => [] as MoodCheck[]),
          getBehaviourRecordsForStudent(subjectId).catch(() => []),
        ]);
        const storedBoard = stored && typeof stored === 'object' && 'behaviourBoard' in stored
          ? (stored as { behaviourBoard?: BehaviourBoardModel }).behaviourBoard
          : undefined;
        if (storedBoard && stored && 'metrics' in (stored as object)) {
          if (!cancelled) {
            setBoard({
              ...storedBoard,
              snapshot: stored as BehaviourBoardModel['snapshot'],
              precomputed: true,
              role,
              scopeLabel: profile.name || 'Student',
            });
          }
          return;
        }
        const next = buildBehaviourBoard({
          role,
          scopeLabel: role === 'parent' ? (children.find(child => child.id === subjectId)?.name || 'Child') : (profile.name || 'You'),
          computedAt: now.toISOString(),
          now,
          moods,
          notes: notes.map(note => ({
            id: note.id,
            studentId: note.studentId,
            studentLabel: note.studentName,
            type: note.type,
            points: note.points,
            description: note.description,
            at: note.createdAt?.toDate ? note.createdAt.toDate().toISOString() : now.toISOString(),
          })),
          focusSessions: focus,
          snapshotInput: {
            scope: role === 'parent' ? 'parent_child' : 'student',
            scopeId: subjectId,
            computedAt: now.toISOString(),
            rangeStart: start,
            rangeEnd: end,
            studyEvents: events.map(event => ({
              minutes: Number(event.minutes) || 0,
              at: event.at,
              weekday: event.weekday,
              hour: event.hour,
              courseId: event.courseId,
            })),
            quizzes: grades.map(grade => ({
              at: grade.gradedAt?.toDate ? grade.gradedAt.toDate().toISOString() : now.toISOString(),
              score: grade.score ?? 0,
              max: grade.maxScore || 1,
              topic: grade.label,
              unitId: grade.lessonId || grade.courseId,
              courseId: grade.courseId,
            })),
            goals: goals.map(goal => ({
              id: goal.id,
              dateKey: goal.dateKey,
              title: goal.title,
              status: goal.status,
              deadline: goal.deadline,
              estimateMinutes: goal.estimateMinutes,
            })),
            attendance: [],
            holidays: [],
            focusSessions: focus,
            hints: 0,
            questions: grades.length,
            aiTurns: 0,
            sparksEarned: 0,
            deadlinesMs: [],
            cohortScores: [],
            previousStudyMinutes: null,
            integrityOpen: false,
            streakBroken: false,
            now,
          },
        });
        if (!cancelled) setBoard(next);
        return;
      }

      const classmates: { studentId: string; label: string; studyMinutes: number; performance: number | null }[] = [];
      if (role === 'teacher') {
        const courses = await getTeacherCourses(user.uid).catch(() => []);
        for (const course of courses.slice(0, 4)) {
          const enrolled = await getEnrollmentsForCourse(course.id ?? '').catch(() => []);
          for (const row of enrolled.slice(0, 12)) {
            const snap = await readSnapshot(row.studentId).catch(() => null);
            const metrics = snap && typeof snap === 'object' && 'metrics' in snap
              ? (snap as { metrics?: { study_time?: number; quiz_average?: number } }).metrics
              : undefined;
            classmates.push({
              studentId: row.studentId,
              label: `Learner ${classmates.length + 1}`,
              studyMinutes: metrics?.study_time ?? 0,
              performance: metrics?.quiz_average ?? null,
            });
          }
        }
      } else if (profile.institutionId) {
        const snap = await getDocs(query(collection(db, 'analytics_snapshots'), where('institutionId', '==', profile.institutionId))).catch(() => null);
        snap?.docs.slice(0, 20).forEach(row => {
          const data = row.data() as { subjectStudentId?: string; metrics?: { study_time?: number; quiz_average?: number } };
          if (!data.subjectStudentId) return;
          classmates.push({
            studentId: data.subjectStudentId,
            label: `Learner ${classmates.length + 1}`,
            studyMinutes: data.metrics?.study_time ?? 0,
            performance: data.metrics?.quiz_average ?? null,
          });
        });
      }
      const next = buildBehaviourBoard({
        role: role === 'teacher' ? 'teacher' : 'institution_admin',
        scopeLabel: role === 'teacher' ? 'Your classes' : (profile.name || 'School'),
        computedAt: now.toISOString(),
        now,
        moods: [],
        notes: [],
        focusSessions: [],
        classmates,
        omitSelf: true,
        snapshotInput: {
          scope: 'teacher',
          scopeId: classmates[0]?.studentId || user.uid,
          computedAt: now.toISOString(),
          rangeStart: start,
          rangeEnd: end,
          studyEvents: [],
          quizzes: [],
          goals: [],
          attendance: [],
          holidays: [],
          focusSessions: [],
          hints: 0,
          questions: 0,
          aiTurns: 0,
          sparksEarned: 0,
          sparksSpent: 0,
          deadlinesMs: [],
          cohortScores: [],
          previousStudyMinutes: null,
          integrityOpen: false,
          streakBroken: false,
          now,
          courseProgress: [],
        },
      });
      if (!cancelled) setBoard(next);
    };
    run().catch(() => { if (!cancelled) setBoard(null); });
    return () => { cancelled = true; };
  }, [user, profile, role, subjectId, goals, children]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Behaviour"
        title="How study"
        accent="is patterned"
        description="Teacher comments here are visible to admin, teachers, and parents. Each figure uses the Reports definition and opens the records behind it."
      />
      {user && (
        <DocumentDelivery
          documents={[textDocument({
            id: `behaviour-${subjectId || user.uid}`,
            title: `Behaviour · ${board?.scopeLabel || 'Class'}`,
            holderEmail: user.email ?? undefined,
            lines: board
              ? [
                ...Object.entries(board.captions).map(([key, text]) => `${key}: ${text}`),
                ...board.classPoints.slice(0, 30).map(point => `${point.label}: ${point.studyMinutes} min`),
              ]
              : ['Behaviour figures appear when there is a signed-in student, child, or class.'],
          })]}
          studentIds={profile?.role === 'admin' ? [] : profile?.role === 'teacher' ? board?.classPoints.map(point => point.studentId) ?? [] : [subjectId].filter(Boolean)}
          institutionId={profile?.role === 'institution_admin' ? profile.institutionId : undefined}
        />
      )}
      {role === 'parent' && children.length > 1 && (
        <label className="text-sm">Child
          <select className="ml-2 rounded border border-border px-2 py-1" value={childId} onChange={event => setChildId(event.target.value)}>
            {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
        </label>
      )}
      {board ? (
        <BehaviourDashboard
          board={board}
          onMood={role === 'student' && user ? async (mood, effort) => {
            try {
              await saveMood(user.uid, isoDateKey(), mood, effort);
              toast.success('Check-in saved');
            } catch {
              toast.error('Could not save the check-in');
            }
          } : undefined}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Behaviour figures appear when there is a signed-in student, child, or class.</p>
      )}
    </DashPage>
  );
}
