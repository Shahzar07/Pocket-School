'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, getSubmissionsForTeacher, getEnrollmentsForCourse, Course, Submission } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, ClipboardList, BarChart3, CheckCircle2, Clock } from 'lucide-react';

interface CourseStats {
  course: Course;
  enrolledCount: number;
  avgProgress: number;
  submissionCount: number;
  avgScore: number | null;
  gradedCount: number;
}

export default function TeacherAnalytics() {
  const { user } = useAuthSTORE();
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getTeacherCourses(user.uid),
      getSubmissionsForTeacher(user.uid),
    ]).then(async ([courses, submissions]) => {
      // Build per-course stats
      const stats: CourseStats[] = await Promise.all(
        courses.map(async (course) => {
          const enrollments = await getEnrollmentsForCourse(course.id!);
          const courseSubs = submissions.filter(s => s.courseId === course.id);
          const gradedSubs = courseSubs.filter(s => s.score !== undefined);
          const avgScore = gradedSubs.length > 0
            ? Math.round(gradedSubs.reduce((sum, s) => sum + (s.score! / s.maxScore) * 100, 0) / gradedSubs.length)
            : null;
          const avgProgress = enrollments.length > 0
            ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
            : 0;

          return {
            course,
            enrolledCount: enrollments.length,
            avgProgress,
            submissionCount: courseSubs.length,
            avgScore,
            gradedCount: gradedSubs.length,
          };
        })
      );
      setCourseStats(stats);
      setRecentSubmissions(submissions.slice(0, 8));
      setLoading(false);
    });
  }, [user]);

  const totalStudents = courseStats.reduce((s, c) => s + c.enrolledCount, 0);
  const totalSubmissions = courseStats.reduce((s, c) => s + c.submissionCount, 0);
  const totalGraded = courseStats.reduce((s, c) => s + c.gradedCount, 0);
  const overallAvg = courseStats.filter(c => c.avgScore !== null).length > 0
    ? Math.round(courseStats.filter(c => c.avgScore !== null).reduce((s, c) => s + c.avgScore!, 0) / courseStats.filter(c => c.avgScore !== null).length)
    : null;

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Student Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time data from your courses and students.</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: totalStudents, icon: <Users className="w-5 h-5 text-blue-500" />, color: 'bg-blue-50 border-blue-200' },
          { label: 'Submissions', value: totalSubmissions, icon: <ClipboardList className="w-5 h-5 text-violet-500" />, color: 'bg-violet-50 border-violet-200' },
          { label: 'Graded', value: totalGraded, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, color: 'bg-emerald-50 border-emerald-200' },
          { label: 'Avg Quiz Score', value: overallAvg !== null ? `${overallAvg}%` : '—', icon: <BarChart3 className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50 border-amber-200' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`${s.color} border rounded-2xl p-5 text-center`}
          >
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Per-course breakdown */}
      {courseStats.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Course Breakdown</h2>
          <div className="space-y-3">
            {courseStats.map((cs, i) => (
              <motion.div key={cs.course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{cs.course.title}</p>
                      <p className="text-xs text-muted-foreground">{cs.course.subject}</p>
                    </div>
                  </div>
                  <Badge className={`rounded-full text-[10px] shrink-0 ${cs.course.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {cs.course.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Students', value: cs.enrolledCount },
                    { label: 'Avg Progress', value: `${cs.avgProgress}%` },
                    { label: 'Submissions', value: cs.submissionCount },
                    { label: 'Avg Score', value: cs.avgScore !== null ? `${cs.avgScore}%` : '—' },
                  ].map((stat, j) => (
                    <div key={j} className="bg-muted/40 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-foreground">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Recent quiz submissions */}
      {recentSubmissions.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Recent Submissions</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {recentSubmissions.map((sub, i) => (
                <div key={sub.id} className="flex items-center gap-4 px-5 py-3">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{sub.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground">{sub.studentName || 'Student'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {sub.score !== undefined ? (
                      <span className={`text-sm font-bold ${(sub.score / sub.maxScore) >= 0.7 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {sub.score}/{sub.maxScore}
                      </span>
                    ) : (
                      <Badge className="rounded-full bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Needs grading</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {courseStats.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No analytics yet.</p>
          <p className="text-sm mt-1">Create and publish courses to start seeing student data here.</p>
        </div>
      )}
    </div>
  );
}
