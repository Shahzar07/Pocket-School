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

export default function TranscriptPage() {
  const { user, profile } = useAuthSTORE();
  const [records, setRecords] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
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
      setRecords(mapped);
      setLoading(false);
    })();
  }, [user]);

  const overallGPA = records.filter(r => r.avg !== null).length > 0
    ? (records.filter(r => r.avg !== null).reduce((s, r) => s + r.gpa, 0) / records.filter(r => r.avg !== null).length).toFixed(2)
    : '—';

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 print:px-8 print:py-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Academic Transcript</h1>
          <p className="text-muted-foreground text-sm mt-1">Official record of your academic performance.</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2 rounded-xl">
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block border-b pb-4 mb-6">
        <h1 className="text-3xl font-bold">Pocket School</h1>
        <h2 className="text-xl mt-1">Official Academic Transcript</h2>
        <p className="text-sm text-gray-500 mt-2">Student: {profile?.name}</p>
        <p className="text-sm text-gray-500">Issued: {new Date().toLocaleDateString()}</p>
      </div>

      {/* GPA Summary */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white text-center">
          <p className="text-3xl font-extrabold">{overallGPA}</p>
          <p className="text-blue-100 text-xs mt-1 font-medium">Cumulative GPA</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-extrabold text-foreground">{records.length}</p>
          <p className="text-muted-foreground text-xs mt-1 font-medium">Courses</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-extrabold text-foreground">{records.filter(r => r.status === 'Completed').length}</p>
          <p className="text-muted-foreground text-xs mt-1 font-medium">Completed</p>
        </motion.div>
      </div>

      {/* Course table */}
      {records.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No courses enrolled yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
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
                <motion.tr key={r.course.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                  <td className="px-5 py-4 font-semibold text-foreground max-w-[200px] truncate">{r.course.title}</td>
                  <td className="px-4 py-4 text-muted-foreground">{r.course.subject}</td>
                  <td className="px-4 py-4 text-center">
                    {r.avg !== null ? (
                      <span className={`font-bold text-lg ${r.avg >= 70 ? 'text-green-600' : r.avg >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {toLetterGrade(r.avg)} <span className="text-sm text-muted-foreground">({r.avg}%)</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-foreground">{r.avg !== null ? r.gpa.toFixed(1) : '—'}</td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.enrollment.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{r.enrollment.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Badge className={`rounded-full text-[10px] ${r.status === 'Completed' ? 'bg-green-100 text-green-700' : r.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground print:block">
        <TrendingUp className="w-3.5 h-3.5" />
        GPA scale: A=4.0 (≥90%), B=3.0 (≥80%), C=2.0 (≥70%), D=1.0 (≥60%), F=0.0
      </div>
    </div>
  );
}
