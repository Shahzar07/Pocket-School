'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAttendanceForCourse, getAttendanceForStudent, getCertificatesForStudent, getChildrenProfiles,
  getEnrollmentsForCourse, getGradesForCourse, getGradesForStudent, getTeacherCourses,
  subscribeDailyGoals, type AttendanceRecord, type DailyGoal, type Grade,
} from '@/lib/db';
import { DashHeader, DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { GlossaryList } from '@/components/insights/boards';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { metricById } from '@/lib/insights/metrics';
import { ReportsHub } from '@/components/insights/reports-hub';
import { buildReportHub, type HubFilters, type ReportCardView, type ReportHub, type ReportRole } from '@/lib/insights/hub';
import { flattenSessionRecords, meanRate, summariseAttendance, type AttendanceMark } from '@/lib/insights/attendance';
import { addDays, isoDateKey } from '@/lib/insights/dates';
import { logReportExport, listReportCards, readSnapshot, saveSchedule, submitAbsenceNote } from '@/lib/insights/client';
import type { GoalLike } from '@/lib/insights/goals';
import type { QuizPoint } from '@/lib/insights/analytics';
import { toast } from 'sonner';

function reportRole(role: string | undefined): ReportRole {
  if (role === 'parent' || role === 'teacher' || role === 'admin' || role === 'institution_admin') return role;
  return 'student';
}

function stamp(grade: Grade): string {
  const at = grade.gradedAt?.toDate?.();
  return at ? isoDateKey(at) : '';
}

function quizFromGrade(grade: Grade): QuizPoint {
  const at = stamp(grade);
  return {
    at: at ? `${at}T12:00:00.000Z` : new Date().toISOString(),
    score: grade.score ?? 0,
    max: grade.maxScore || 1,
    topic: grade.label,
    unitId: grade.lessonId || grade.courseId,
    courseId: grade.courseId,
    lessonId: grade.lessonId,
  };
}

function marksFromSessions(records: AttendanceRecord[], institutionId: string): AttendanceMark[] {
  return flattenSessionRecords(records.map(record => ({
    courseId: record.courseId,
    dateKey: record.dateKey || (record.date?.toDate ? isoDateKey(record.date.toDate()) : ''),
    records: record.records,
  }))).map(mark => ({ ...mark, classId: mark.courseId, institutionId: institutionId || undefined }));
}

function goalLike(goal: DailyGoal): GoalLike {
  return {
    id: goal.id,
    dateKey: goal.dateKey,
    title: goal.title,
    status: goal.status,
    estimateMinutes: goal.estimateMinutes,
    completedLessonIds: (goal as DailyGoal & { completedLessonIds?: string[] }).completedLessonIds,
  };
}

interface Loaded {
  scopeLabel: string;
  studentId: string;
  courseId: string;
  institutionId: string;
  marks: AttendanceMark[];
  quizzes: QuizPoint[];
  certificates: { id: string; title: string; at: string }[];
  enrolments: { id: string; courseTitle: string; amount: number; at: string; studentLabel: string }[];
  classRates: Array<number | null>;
  institutionRates: Array<number | null>;
  storedAttendance: number | null;
  reportCard: ReportCardView | null;
  childId: string;
  studentIds: string[];
}

const EMPTY_FILTERS = (institutionId: string): HubFilters => {
  const end = isoDateKey();
  return {
    rangeStart: addDays(end, -27),
    rangeEnd: end,
    courseId: '',
    classId: '',
    studentId: '',
    institutionId,
    bloom: '',
  };
};

export default function ReportsPage() {
  const { user, profile } = useAuthSTORE();
  const role = reportRole(profile?.role);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [filters, setFilters] = useState<HubFilters | null>(null);
  const [childId, setChildId] = useState('');
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user || role !== 'parent') return;
    getChildrenProfiles(user.uid).then(rows => {
      const list = rows.map(row => ({ id: row.id, name: row.data.name || 'Child' }));
      setChildren(list);
      setChildId(current => current || list[0]?.id || '');
    }).catch(() => setChildren([]));
  }, [user, role]);

  useEffect(() => {
    const studentId = role === 'parent' ? childId : role === 'student' ? user?.uid : '';
    if (!studentId) return;
    return subscribeDailyGoals(studentId, setGoals);
  }, [user, role, childId]);

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    const institutionId = profile.institutionId ?? '';
    const run = async () => {
      const subjectId = role === 'parent' ? childId : user.uid;
      if ((role === 'student' || role === 'parent') && !subjectId) return;
      const [grades, attendance, certificates, snapshot, cards] = await Promise.all([
        subjectId ? getGradesForStudent(subjectId).catch(() => [] as Grade[]) : Promise.resolve([] as Grade[]),
        subjectId ? getAttendanceForStudent(subjectId).catch(() => [] as AttendanceRecord[]) : Promise.resolve([] as AttendanceRecord[]),
        subjectId ? getCertificatesForStudent(subjectId).catch(() => []) : Promise.resolve([]),
        subjectId ? readSnapshot(subjectId).catch(() => null) : Promise.resolve(null),
        subjectId ? listReportCards('studentId', subjectId).catch(() => []) : Promise.resolve([]),
      ]);
      let linkedIds = subjectId ? [subjectId] : [];
      let courseMarks = marksFromSessions(attendance, institutionId);
      let courseGrades = grades;
      let enrolments: Loaded['enrolments'] = [];
      let classRates: Array<number | null> = [];
      if (role === 'teacher' || role === 'admin' || role === 'institution_admin') {
        const courses = await getTeacherCourses(user.uid).catch(() => []);
        const packs = await Promise.all(courses.slice(0, 6).map(async course => {
          const id = course.id ?? '';
          const [rows, enrolled, courseGrades] = await Promise.all([
            getAttendanceForCourse(id).catch(() => [] as AttendanceRecord[]),
            getEnrollmentsForCourse(id).catch(() => []),
            getGradesForCourse(id).catch(() => [] as Grade[]),
          ]);
          return { course, rows, enrolled, courseGrades };
        }));
        courseMarks = packs.flatMap(pack => marksFromSessions(pack.rows, institutionId));
        courseGrades = packs.flatMap(pack => pack.courseGrades);
        enrolments = packs.flatMap(pack => pack.enrolled.map((row, index) => ({
          id: `${pack.course.id}-${row.studentId}`,
          courseTitle: pack.course.title,
          amount: 0,
          at: new Date().toISOString(),
          studentLabel: `Learner ${index + 1}`,
        })));
        classRates = packs.map(pack => summariseAttendance(marksFromSessions(pack.rows, institutionId)).rate);
        linkedIds = [...new Set(packs.flatMap(pack => pack.enrolled.map(row => row.studentId)))];
      }
      const stored = snapshot && typeof (snapshot as { metrics?: { attendance_rate?: number } }).metrics?.attendance_rate === 'number'
        ? (snapshot as { metrics: { attendance_rate: number } }).metrics.attendance_rate
        : null;
      const card = cards[0] as { studentName?: string; courseTitle?: string; grade?: string; comment?: string; termId?: string; year?: number; heading?: string } | undefined;
      const next: Loaded = {
        scopeLabel: role === 'parent' ? (children.find(child => child.id === childId)?.name || 'Child') : profile.name || 'Reports',
        studentId: role === 'teacher' || role === 'admin' || role === 'institution_admin' ? '' : subjectId,
        courseId: '',
        institutionId,
        marks: courseMarks,
        quizzes: courseGrades.map(quizFromGrade),
        certificates: certificates.map(cert => ({
          id: cert.id || cert.courseId,
          title: cert.courseTitle,
          at: cert.issuedAt?.toDate ? cert.issuedAt.toDate().toISOString() : new Date().toISOString(),
        })),
        enrolments,
        classRates,
        institutionRates: role === 'institution_admin' || role === 'admin' ? classRates : [],
        storedAttendance: stored,
        reportCard: card ? {
          studentName: card.studentName || profile.name || 'Student',
          courseTitle: card.courseTitle || 'Course',
          grade: String(card.grade ?? ''),
          comment: card.comment || '',
          termId: card.termId || '',
          year: card.year || new Date().getFullYear(),
          heading: card.heading || 'Term report',
        } : null,
        childId: subjectId,
        studentIds: linkedIds,
      };
      if (!cancelled) {
        setLoaded(next);
        setFilters(current => current ?? { ...EMPTY_FILTERS(institutionId), studentId: next.studentId });
      }
    };
    run().catch(() => { if (!cancelled) setLoaded(null); });
    return () => { cancelled = true; };
  }, [user, profile, role, childId, children]);

  const hub: ReportHub | null = useMemo(() => {
    if (!loaded || !filters) return null;
    const previousEnd = addDays(filters.rangeStart, -1);
    const previousStart = addDays(previousEnd, -27);
    const inWindow = loaded.marks.filter(mark => mark.dateKey >= filters.rangeStart && mark.dateKey <= filters.rangeEnd);
    const byStudent = [...new Set(inWindow.map(mark => mark.studentId))];
    const classRates = loaded.classRates.length
      ? loaded.classRates
      : byStudent.map(id => summariseAttendance(inWindow.filter(mark => mark.studentId === id)).rate);
    return buildReportHub({
      role,
      scopeLabel: loaded.scopeLabel,
      computedAt: new Date().toISOString(),
      filters,
      holidays: [],
      marks: loaded.marks,
      previousMarks: loaded.marks.filter(mark => mark.dateKey >= previousStart && mark.dateKey <= previousEnd),
      classRates,
      institutionRates: loaded.institutionRates.length ? [meanRate(loaded.institutionRates)] : [],
      quizzes: loaded.quizzes,
      goals: goals.map(goalLike),
      studyEvents: [],
      focusSessions: [],
      certificates: loaded.certificates,
      enrolments: loaded.enrolments,
      notes: [],
      cohortScores: [],
      hints: 0,
      questions: loaded.quizzes.length,
      aiTurns: 0,
      sparksEarned: 0,
      storedAttendance: loaded.storedAttendance,
      reportCard: loaded.reportCard,
      now: new Date(),
    });
  }, [loaded, filters, goals, role]);

  const canSchedule = role === 'parent' || role === 'teacher' || role === 'admin' || role === 'institution_admin';

  return (
    <DashPage>
      <DashHeader
        eyebrow="Reports"
        title="Every number,"
        accent="with its records"
        description="The same definitions as the analytics charts. A click opens the lessons, quizzes, or attendance rows behind the figure. Exports carry the Poket School copyright line."
      />
      {hub && (
        <DocumentDelivery
          documents={[textDocument({
            id: `report-${loaded?.studentId || user?.uid || 'class'}`,
            title: `Report · ${hub.scopeLabel}`,
            holderEmail: user?.email ?? undefined,
            lines: hub.sections.flatMap(section => [
              section.title,
              ...section.kpis.map(kpi => `${metricById(kpi.metricId)?.label ?? kpi.metricId}: ${kpi.value ?? '—'}`),
            ]),
          })]}
          studentIds={role === 'admin' ? [] : (loaded?.studentIds ?? [])}
          institutionId={role === 'institution_admin' ? profile?.institutionId : undefined}
        />
      )}
      {role === 'parent' && children.length > 1 && (
        <label className="text-sm">Child
          <select className="ml-2 rounded border border-border px-2 py-1" value={childId} onChange={event => { setChildId(event.target.value); setFilters(null); }}>
            {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
        </label>
      )}
      {hub && filters && (
        <ReportsHub
          hub={hub}
          onFilters={setFilters}
          onSchedule={canSchedule ? async cadence => {
            if (!user || !profile) return;
            try {
              await saveSchedule({
                ownerId: user.uid,
                role,
                cadence,
                metricIds: ['study_time', 'quiz_average', 'attendance_rate', 'mastery'],
                scopeId: filters.studentId || user.uid,
                scopeLabel: hub.scopeLabel,
                nextRun: isoDateKey(),
              });
              toast.success(`Scheduled ${cadence}`);
            } catch {
              toast.error('Could not schedule that report');
            }
          } : undefined}
          onExport={async format => {
            if (!user || !profile) return;
            try {
              await logReportExport({
                actorId: user.uid,
                role: profile.role,
                format,
                metricIds: hub.sections.flatMap(section => section.kpis.map(kpi => kpi.metricId)),
                scopeId: filters.studentId || user.uid,
                at: new Date().toISOString(),
              });
            } catch {
              toast.error('The file downloaded, and the export was not recorded');
            }
          }}
          onAbsence={role === 'parent' && childId ? async (reason, dateKey) => {
            if (!user) return;
            try {
              await submitAbsenceNote({ studentId: childId, parentId: user.uid, dateKey, reason });
              toast.success('Absence note sent');
            } catch {
              toast.error('Could not send the absence note');
            }
          } : undefined}
        />
      )}
      {canSchedule && (
        <p className="text-sm text-muted-foreground">A daily, weekly, or termly schedule sends a notification when it is due. Nothing is emailed unless the school already sends mail.</p>
      )}
      <Panel>
        <PanelHeader title="Glossary" />
        <GlossaryList />
      </Panel>
    </DashPage>
  );
}
