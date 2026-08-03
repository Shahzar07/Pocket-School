'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getEnrolledCourses, getGradesForStudent, getAttendanceForStudent,
  Course, Enrollment, Grade, AttendanceRecord,
} from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Printer, TrendingUp } from 'lucide-react';
import {
  TERMS, TermId, termRange, inRange, formatPeriod, selectableYears,
} from '@/lib/reporting-periods';

interface CourseRecord { course: Course; enrollment: Enrollment; grades: Grade[]; avg: number | null; gpa: number; status: string }


const toGPA = (pct: number) => {
  if (pct >= 90) return 4.0;
  if (pct >= 80) return 3.0;
  if (pct >= 70) return 2.0;
  if (pct >= 60) return 1.0;
  return 0.0;
};

const toLetterGrade = (pct: number) => {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
};

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function TranscriptPage() {
  const { user, profile } = useAuthSTORE();
  const [enrolled, setEnrolled] = useState<{ course: Course; enrollment: Enrollment }[]>([]);
  const [allGrades, setAllGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const thisYear = new Date().getFullYear();
  const [term, setTerm] = useState<TermId>('all');
  const [year, setYear] = useState(thisYear);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [enrollments, grades, att] = await Promise.all([
        getEnrolledCourses(user.uid),
        getGradesForStudent(user.uid),
        // Attendance is supporting detail — a failure here shouldn't blank the
        // whole transcript.
        getAttendanceForStudent(user.uid).catch(() => [] as AttendanceRecord[]),
      ]);
      setEnrolled(enrollments);
      setAllGrades(grades);
      setAttendance(att);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = useMemo(
    () => termRange(term, year, customFrom, customTo),
    [term, year, customFrom, customTo],
  );

  const periodLabel = useMemo(() => formatPeriod(range), [range]);

  const records = useMemo<CourseRecord[]>(() => {
    const scoped = allGrades.filter(g => inRange(g.gradedAt, range));
    return enrolled
      .map(({ course, enrollment }) => {
        const cGrades = scoped.filter(g => g.courseId === course.id);
        const avg = cGrades.length > 0
          ? Math.round(cGrades.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / cGrades.length)
          : null;
        const gpa = avg !== null ? toGPA(avg) : 0;
        const status = enrollment.progress === 100 ? 'Completed' : enrollment.progress > 0 ? 'In Progress' : 'Enrolled';
        return { course, enrollment, grades: cGrades, avg, gpa, status };
      })
      .sort((a, b) => a.course.title.localeCompare(b.course.title));
  }, [enrolled, allGrades, range]);

  /** Attendance tally for the selected period, for the report card. */
  const attendanceSummary = useMemo(() => {
    const tally = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    if (!user) return tally;
    for (const rec of attendance) {
      if (!inRange(rec.date, range)) continue;
      const entry = rec.records.find(e => e.studentId === user.uid);
      if (!entry) continue;
      tally[entry.status] += 1;
      tally.total += 1;
    }
    return tally;
  }, [attendance, range, user]);

  const attendanceRate = attendanceSummary.total > 0
    ? Math.round(((attendanceSummary.present + attendanceSummary.late) / attendanceSummary.total) * 100)
    : null;

  const graded = records.filter(r => r.avg !== null);
  const overallGPA = graded.length > 0
    ? (graded.reduce((s, r) => s + r.gpa, 0) / graded.length).toFixed(2)
    : '—';
  const overallAverage = graded.length > 0
    ? Math.round(graded.reduce((s, r) => s + (r.avg ?? 0), 0) / graded.length)
    : null;

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-6 pt-8">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 print:px-8 print:py-6">
      {/* Page header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex items-end justify-between gap-4 print:hidden"
      >
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Student Records</p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
            Academic <span className="gradient-text italic">Transcript</span>
          </h1>
          <p className="text-muted-foreground text-sm">Official record of your academic performance.</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="rounded-full h-11 px-5 font-bold gap-2">
          <Printer className="w-4 h-4" /> Print report card
        </Button>
      </motion.div>

      {/* Reporting period ─ drives every figure below and the printed card */}
      <div className="print:hidden flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="rc-term" className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Reporting period
          </label>
          <select
            id="rc-term"
            value={term}
            onChange={e => setTerm(e.target.value as TermId)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
          >
            {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {term !== 'all' && term !== 'custom' && (
          <div className="space-y-1.5">
            <label htmlFor="rc-year" className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Year
            </label>
            <select
              id="rc-year"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
            >
              {selectableYears().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {term === 'custom' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="rc-from" className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">From</label>
              <input id="rc-from" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rc-to" className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">To</label>
              <input id="rc-to" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground" />
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground pb-3">
          Showing <span className="font-semibold text-foreground">{periodLabel}</span>
        </p>
      </div>

      {/* Report-card letterhead — print only */}
      <div className="hidden print:block mb-6">
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Poket School</h1>
            <p className="text-[10px] tracking-wide">Poket Media Sdn Bhd (1332289-X)</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold leading-tight">Student Report Card</h2>
            <p className="text-[11px]">Issued {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] mt-3">
          <p><span className="font-semibold">Student:</span> {profile?.name ?? '—'}</p>
          <p><span className="font-semibold">Reporting period:</span> {periodLabel}</p>
          <p><span className="font-semibold">Email:</span> {user?.email ?? '—'}</p>
          <p><span className="font-semibold">Year group:</span> {profile?.yearGroup ?? '—'}</p>
          <p><span className="font-semibold">Courses reported:</span> {records.length}</p>
          <p><span className="font-semibold">Cumulative GPA:</span> {overallGPA}</p>
          <p>
            <span className="font-semibold">Overall average:</span>{' '}
            {overallAverage !== null ? `${overallAverage}% (${toLetterGrade(overallAverage)})` : '—'}
          </p>
        </div>
      </div>

      {/* GPA Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-primary opacity-80" />
          <p className="text-3xl font-extrabold text-foreground">{overallGPA}</p>
          <p className="text-muted-foreground text-xs mt-1 font-medium">Cumulative GPA</p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-emerald-500 opacity-80" />
          <p className="text-3xl font-extrabold text-foreground">{records.length}</p>
          <p className="text-muted-foreground text-xs mt-1 font-medium">Courses</p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-amber-500 opacity-80" />
          <p className="text-3xl font-extrabold text-foreground">{records.filter(r => r.status === 'Completed').length}</p>
          <p className="text-muted-foreground text-xs mt-1 font-medium">Completed</p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
          className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-sky-500 opacity-80" />
          <p className="text-3xl font-extrabold text-foreground">
            {attendanceRate !== null ? `${attendanceRate}%` : '—'}
          </p>
          <p className="text-muted-foreground text-xs mt-1 font-medium">Attendance</p>
        </motion.div>
      </div>

      {/* Course table */}
      {records.length === 0 ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
          className="text-center py-20"
        >
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-primary/20 blur-2xl" />
            <GraduationCap className="w-14 h-14 text-muted-foreground/40 relative" />
          </div>
          <p className="font-heading text-2xl text-foreground">No courses enrolled yet</p>
          <p className="text-muted-foreground text-sm mt-2">Enroll in courses to see your transcript here.</p>
        </motion.div>
      ) : (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-4 print:text-black print:text-sm print:tracking-wide">
            Course Records
          </p>
          <div className="bg-card border border-border rounded-3xl overflow-hidden card-glow print:rounded-none print:border-black">
            <table className="w-full text-sm print:text-[12px]">
              <thead className="bg-muted/50 print:bg-transparent print:border-b print:border-black">
                <tr>
                  <th className="text-left px-5 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Subject</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Grade</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">GPA</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r, i) => (
                  <motion.tr
                    key={r.course.id}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={i}
                  >
                    <td className="px-5 py-4 font-semibold text-foreground max-w-[200px] truncate">{r.course.title}</td>
                    <td className="px-4 py-4 text-muted-foreground">{r.course.subject}</td>
                    <td className="px-4 py-4 text-center">
                      {r.avg !== null ? (
                        <span className={`font-bold text-lg ${r.avg >= 70 ? 'text-emerald-500' : r.avg >= 60 ? 'text-amber-500' : 'text-destructive'}`}>
                          {toLetterGrade(r.avg)} <span className="text-sm text-muted-foreground">({r.avg}%)</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-foreground">{r.avg !== null ? r.gpa.toFixed(1) : '—'}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden print:hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${r.enrollment.progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground print:text-black print:text-[12px]">{r.enrollment.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge className={`rounded-full text-[10px] ${
                        r.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : r.status === 'In Progress'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {r.status}
                      </Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Attendance + sign-off — print only */}
      <div className="hidden print:block mt-6 break-inside-avoid">
        <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-2">Attendance</h3>
        {attendanceSummary.total === 0 ? (
          <p className="text-[12px]">No attendance was recorded for this period.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2 text-[12px]">
            <p><span className="font-semibold">Sessions:</span> {attendanceSummary.total}</p>
            <p><span className="font-semibold">Present:</span> {attendanceSummary.present}</p>
            <p><span className="font-semibold">Late:</span> {attendanceSummary.late}</p>
            <p><span className="font-semibold">Absent:</span> {attendanceSummary.absent}</p>
            <p><span className="font-semibold">Excused:</span> {attendanceSummary.excused}</p>
          </div>
        )}

        <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mt-5 mb-2">
          Teacher comments
        </h3>
        <div className="h-16 border border-black/40 rounded-sm" />

        <div className="grid grid-cols-2 gap-10 mt-8 text-[11px]">
          <div>
            <div className="border-b border-black h-8" />
            <p className="mt-1">Class teacher</p>
          </div>
          <div>
            <div className="border-b border-black h-8" />
            <p className="mt-1">Parent / guardian</p>
          </div>
        </div>

        <p className="text-[10px] mt-6 pt-2 border-t border-black/30">
          GPA scale: A=4.0 (≥90%), B=3.0 (≥80%), C=2.0 (≥70%), D=1.0 (≥60%), F=0.0.
          This report card covers {periodLabel.toLowerCase()} and reflects records held at the time of issue.
        </p>
      </div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
        className="flex items-center gap-2 text-xs text-muted-foreground print:hidden"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        GPA scale: A=4.0 (≥90%), B=3.0 (≥80%), C=2.0 (≥70%), D=1.0 (≥60%), F=0.0
      </motion.div>

      {/* Report cards must print on white with visible rules regardless of theme. */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          html, body {
            background: #fff !important;
            color: #000 !important;
          }
          nav, aside, header, footer,
          [data-sidebar], [data-dashboard-nav] { display: none !important; }
          .card-glow { box-shadow: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
