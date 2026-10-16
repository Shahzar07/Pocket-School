'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { createDailyGoal, getAttendanceForStudent, getGradesForStudent, goalDateKey, subscribeDailyGoals, type DailyGoal } from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { AnalyticsBoard, BehaviourBoard, ExportBar, snapshotKpis } from '@/components/insights/boards';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { metricById } from '@/lib/insights/metrics';
import { LearningCharts } from '@/components/insights/learning-charts';
import { buildSnapshot, type AnalyticsSnapshot } from '@/lib/insights/aggregate';
import { readSnapshot, saveMood } from '@/lib/insights/client';
import { isoDateKey, addDays } from '@/lib/insights/dates';
import type { Mood } from '@/lib/insights/behaviour';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function liveSnapshot(studentId: string, goals: DailyGoal[], grades: { percentage?: number; score?: number; maxScore?: number; gradedAt?: { toDate?: () => Date } }[], attendance: { date?: { toDate?: () => Date }; records?: { studentId: string; status: 'present' | 'absent' | 'late' | 'excused' }[] }[]): AnalyticsSnapshot {
  const now = new Date();
  const end = isoDateKey(now);
  return buildSnapshot({
    scope: 'student',
    scopeId: studentId,
    computedAt: now.toISOString(),
    rangeStart: addDays(end, -27),
    rangeEnd: end,
    studyEvents: [],
    quizzes: grades.map(g => ({
      at: g.gradedAt?.toDate?.()?.toISOString() ?? end,
      score: g.percentage ?? g.score ?? 0,
      max: g.percentage != null ? 100 : (g.maxScore || 1),
    })),
    goals: goals.map(g => ({ dateKey: g.dateKey, title: g.title, status: g.status, deadline: g.deadline })),
    attendance: attendance.flatMap(record => (record.records ?? []).filter(row => row.studentId === studentId).map(row => ({
      dateKey: record.date?.toDate ? isoDateKey(record.date.toDate()) : end,
      status: row.status,
      studentId,
      source: 'manual' as const,
    }))),
    holidays: [],
    focusSessions: [],
    hints: 0,
    questions: grades.length,
    aiTurns: 0,
    sparksEarned: goals.reduce((sum, g) => sum + (g.sparksAwarded ? g.sparksBonus ?? 0 : 0), 0),
    deadlinesMs: [],
    cohortScores: [],
    previousStudyMinutes: null,
    integrityOpen: false,
    streakBroken: false,
    now,
  });
}

export default function StudentAnalyticsPage() {
  const { user, profile } = useAuthSTORE();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [live, setLive] = useState(true);
  const [mood, setMood] = useState<Mood | null>(null);
  const [tab, setTab] = useState<'insights' | 'behaviour'>('insights');

  useEffect(() => {
    if (!user) return;
    let goals: DailyGoal[] = [];
    const unsub = subscribeDailyGoals(user.uid, list => { goals = list; });
    Promise.all([
      readSnapshot(user.uid).catch(() => null),
      getGradesForStudent(user.uid).catch(() => []),
      getAttendanceForStudent(user.uid).catch(() => []),
    ]).then(([stored, grades, attendance]) => {
      if (stored && stored.metrics) {
        setSnapshot(stored as AnalyticsSnapshot);
        setLive(false);
      } else {
        setSnapshot(liveSnapshot(user.uid, goals, grades as never, attendance as never));
        setLive(true);
      }
    });
    return unsub;
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    try {
      const res = await authedFetch('/api/insights/refresh-snapshot', { method: 'POST', body: JSON.stringify({ studentId: user.uid }) });
      if (res.snapshot) {
        setSnapshot(res.snapshot as AnalyticsSnapshot);
        setLive(false);
      }
    } catch {
      const fresh = await readSnapshot(user.uid).catch(() => null);
      if (fresh) setSnapshot(fresh as AnalyticsSnapshot);
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Insights"
        title="How your learning"
        accent="is going"
        description="Study time, quizzes, mastery, goals, and Sparks use the same definitions parents, teachers, and admin see on reports."
        actions={<Button variant="outline" onClick={refresh}>Refresh saved totals</Button>}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/dashboard/student/attendance" className="underline">Attendance</Link>
        <Link href="/dashboard/reports" className="underline">Reports</Link>
        <Link href="/dashboard/behaviour" className="underline">Behaviour</Link>
      </div>
      {user && (
        <DocumentDelivery
          documents={[textDocument({
            id: `analytics-${user.uid}`,
            title: 'Learning analytics',
            holderEmail: user.email ?? undefined,
            studentId: user.uid,
            lines: snapshot
              ? Object.entries(snapshot.metrics).map(([id, value]) => `${metricById(id)?.label ?? id}: ${value ?? '—'}`)
              : ['Totals are still loading.'],
          })]}
          studentIds={[user.uid]}
        />
      )}
      <div className="flex gap-2">
        <Button variant={tab === 'insights' ? 'default' : 'outline'} onClick={() => setTab('insights')}>Insights</Button>
        <Button variant={tab === 'behaviour' ? 'default' : 'outline'} onClick={() => setTab('behaviour')}>Behaviour</Button>
      </div>
      {snapshot && <ExportBar kpis={snapshotKpis(snapshot)} />}
      {!snapshot ? <Panel><PanelHeader title="Loading" /></Panel> : tab === 'insights' ? (
        <>
          <LearningCharts
            snapshot={snapshot}
            onMakeGoal={(title, minutes) => {
              if (!user) return;
              createDailyGoal({
                studentId: user.uid,
                studentName: profile?.name ?? 'Student',
                dateKey: goalDateKey(),
                title,
                category: 'study',
                estimateMinutes: minutes,
                deadline: '18:00',
                status: 'not_started',
                source: 'ai',
                progress: 0,
              }).then(() => router.push('/dashboard/student/goals')).catch(() => router.push(`/dashboard/student/goals?add=1&title=${encodeURIComponent(title)}`));
            }}
          />
          <AnalyticsBoard snapshot={snapshot} live={live} />
        </>
      ) : (
        <BehaviourBoard
          snapshot={snapshot}
          mood={mood}
          onMood={value => {
            setMood(value);
            if (user) saveMood(user.uid, isoDateKey(), value).catch(() => {});
          }}
        />
      )}
      {snapshot && <p className="sr-only">{snapshotKpis(snapshot).length} metrics</p>}
    </DashPage>
  );
}
