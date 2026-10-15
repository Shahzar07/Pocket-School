'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getAttendanceForStudent, getGradesForStudent, subscribeDailyGoals, type DailyGoal, type Grade } from '@/lib/db';
import { DashHeader, DashPage, Panel, PanelHeader, Segmented } from '@/components/dash-ui';
import { AnalyticsBoard, BehaviourBoard, ExportBar, GlossaryList, GlossaryTip, snapshotKpis } from '@/components/insights/boards';
import { buildSnapshot, type AnalyticsSnapshot } from '@/lib/insights/aggregate';
import { addDays, isoDateKey } from '@/lib/insights/dates';
import { delta } from '@/lib/insights/reports';
import { saveSchedule } from '@/lib/insights/client';
import { metricById } from '@/lib/insights/metrics';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Range = 'week' | 'month';

export default function ReportsPage() {
  const { user, profile } = useAuthSTORE();
  const [range, setRange] = useState<Range>('month');
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [openMetric, setOpenMetric] = useState<string | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== 'student') return;
    return subscribeDailyGoals(user.uid, setGoals);
  }, [user, profile?.role]);

  useEffect(() => {
    if (!user || profile?.role !== 'student') return;
    const now = new Date();
    const end = isoDateKey(now);
    const span = range === 'week' ? 7 : 28;
    const start = addDays(end, -(span - 1));
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(span - 1));
    const stamp = (grade: Grade) => {
      const at = grade.gradedAt?.toDate?.();
      return at ? isoDateKey(at) : '';
    };
    Promise.all([
      getGradesForStudent(user.uid).catch(() => [] as Grade[]),
      getAttendanceForStudent(user.uid).catch(() => []),
    ]).then(([grades, attendance]) => {
      const inWindow = (grade: Grade, from: string, to: string) => {
        const key = stamp(grade);
        return key ? key >= from && key <= to : false;
      };
      const make = (from: string, to: string, quizGrades: Grade[]) => buildSnapshot({
        scope: 'student',
        scopeId: user.uid,
        computedAt: now.toISOString(),
        rangeStart: from,
        rangeEnd: to,
        studyEvents: [],
        quizzes: quizGrades.map(g => ({ at: stamp(g) || to, score: g.score ?? 0, max: g.maxScore || 1 })),
        goals: goals.filter(g => g.dateKey >= from && g.dateKey <= to).map(g => ({ dateKey: g.dateKey, title: g.title, status: g.status })),
        attendance: attendance.flatMap(record => (record.records ?? []).filter(row => row.studentId === user.uid).map(row => ({
          dateKey: to,
          status: row.status,
          studentId: user.uid,
          source: 'manual' as const,
        }))),
        holidays: [],
        focusSessions: [],
        hints: 0,
        questions: quizGrades.length,
        aiTurns: 0,
        sparksEarned: 0,
        deadlinesMs: [],
        cohortScores: [],
        previousStudyMinutes: null,
        integrityOpen: false,
        streakBroken: false,
        now,
      });
      const currentGrades = grades.filter(grade => inWindow(grade, start, end) || !stamp(grade));
      const priorGrades = grades.filter(grade => inWindow(grade, previousStart, previousEnd));
      setSnapshot(make(start, end, currentGrades));
      setPrevious(make(previousStart, previousEnd, priorGrades).metrics.quiz_average);
    });
  }, [user, profile?.role, range, goals]);

  const kpis = useMemo(() => snapshot ? snapshotKpis(snapshot, {
    goal_completion: goals.map(goal => ({ id: goal.id, when: goal.dateKey, label: goal.title, value: goal.status })),
  }) : [], [snapshot, goals]);
  const quizDelta = delta(snapshot?.metrics.quiz_average ?? null, previous);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Reports"
        title="Every number,"
        accent="with its records"
        description="Filters, a comparison with the previous reading, and exports. The footer on every file is the Poket School copyright line."
        actions={snapshot ? <ExportBar kpis={kpis} /> : undefined}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={[{ id: 'week', label: '7 days' }, { id: 'month', label: '28 days' }] as const} value={range} onChange={setRange} />
        {quizDelta.direction !== 'na' && (
          <p className="text-xs text-muted-foreground">Quiz average vs this reading: {quizDelta.diff} ({quizDelta.direction})</p>
        )}
      </div>
      {profile?.role === 'student' && snapshot && (
        <>
          <AnalyticsBoard snapshot={snapshot} live />
          <BehaviourBoard snapshot={snapshot} />
          <Panel>
            <PanelHeader title="Drill down" meta={<GlossaryTip id="quiz_average" />} />
            <div className="flex flex-wrap gap-2 mb-3">
              {kpis.map(kpi => (
                <button key={kpi.metricId} type="button" className="h-8 px-3 rounded-full border border-border text-xs font-semibold" onClick={() => setOpenMetric(kpi.metricId)}>
                  {metricById(kpi.metricId)?.label}
                </button>
              ))}
            </div>
            {openMetric && (
              <div className="space-y-1">
                {(kpis.find(k => k.metricId === openMetric)?.records ?? []).map(record => (
                  <p key={record.id} className="text-sm">{record.when} · {record.label} · {record.value}</p>
                ))}
                {(kpis.find(k => k.metricId === openMetric)?.records.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No row-level records for this metric in the range.</p>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
      {profile?.role !== 'student' && (
        <Panel>
          <PanelHeader title="Schedule a report" />
          <p className="text-sm text-muted-foreground mb-3">You will get a notification when it is ready. The nightly job sends it. Nothing is emailed unless your school already sends mail.</p>
          <Button onClick={async () => {
            if (!user || !profile) return;
            const role = profile.role === 'parent' || profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'institution_admin'
              ? profile.role : 'teacher';
            await saveSchedule({
              ownerId: user.uid,
              role,
              cadence: 'weekly',
              metricIds: ['study_time', 'quiz_average', 'attendance_rate'],
              scopeId: user.uid,
              scopeLabel: profile.name ?? 'Report',
              nextRun: isoDateKey(),
            });
            toast.success('Weekly report scheduled');
          }}>Schedule weekly</Button>
        </Panel>
      )}
      <Panel>
        <PanelHeader title="Glossary" />
        <GlossaryList />
      </Panel>
    </DashPage>
  );
}
