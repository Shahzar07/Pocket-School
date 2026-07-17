'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getGradesForStudent, Course, Enrollment, Grade } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Printer, TrendingUp } from 'lucide-react';

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
  const [records, setRecords] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [enrollments, grades] = await Promise.all([
        getEnrolledCourses(user.uid),
        getGradesForStudent(user.uid),
      ]);
      const mapped: CourseRecord[] = enrollments.map(({ course, enrollment }) => {
        const cGrades = grades.filter(g => g.courseId === course.id);
        const avg = cGrades.length > 0
          ? Math.round(cGrades.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / cGrades.length)
          : null;
        const gpa = avg !== null ? toGPA(avg) : 0;
        const status = enrollment.progress === 100 ? 'Completed' : enrollment.progress > 0 ? 'In Progress' : 'Enrolled';
        return { course, enrollment, grades: cGrades, avg, gpa, status };
      });
      // Defensive client-side sort (alphabetical by course title)
      mapped.sort((a, b) => a.course.title.localeCompare(b.course.title));
      setRecords(mapped);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const overallGPA = records.filter(r => r.avg !== null).length > 0
    ? (records.filter(r => r.avg !== null).reduce((s, r) => s + r.gpa, 0) / records.filter(r => r.avg !== null).length).toFixed(2)
    : '—';

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
          <Printer className="w-4 h-4" /> Print
        </Button>
      </motion.div>

      {/* Print header */}
      <div className="hidden print:block border-b pb-4 mb-6">
        <h1 className="text-3xl font-bold">Pocket School</h1>
        <h2 className="text-xl mt-1">Official Academic Transcript</h2>
        <p className="text-sm text-muted-foreground mt-2">Student: {profile?.name}</p>
        <p className="text-sm text-muted-foreground">Issued: {new Date().toLocaleDateString()}</p>
      </div>

      {/* GPA Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-4">Course Records</p>
          <div className="bg-card border border-border rounded-3xl overflow-hidden card-glow">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
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
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${r.enrollment.progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{r.enrollment.progress}%</span>
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

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
        className="flex items-center gap-2 text-xs text-muted-foreground print:block"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        GPA scale: A=4.0 (≥90%), B=3.0 (≥80%), C=2.0 (≥70%), D=1.0 (≥60%), F=0.0
      </motion.div>
    </div>
  );
}
