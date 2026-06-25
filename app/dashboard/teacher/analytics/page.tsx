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

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

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
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-8">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 flex items-center gap-2">
          <span className="w-5 h-px bg-emerald-600 inline-block" /> Student Analytics
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          Your <span className="gradient-text italic">Analytics</span> Dashboard
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">Real-time data from your courses and students.</p>
      </motion.header>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: totalStudents, icon: <Users className="w-5 h-5 text-blue-500" />, gradient: 'from-blue-500 to-indigo-500' },
          { label: 'Submissions', value: totalSubmissions, icon: <ClipboardList className="w-5 h-5 text-violet-500" />, gradient: 'from-violet-500 to-purple-500' },
          { label: 'Graded', value: totalGraded, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, gradient: 'from-emerald-500 to-teal-500' },
          { label: 'Avg Quiz Score', value: overallAvg !== null ? `${overallAvg}%` : '—', icon: <BarChart3 className="w-5 h-5 text-amber-500" />, gradient: 'from-amber-500 to-orange-500' },
        ].map((s, i) => (
          <motion.div key={i} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.gradient}`} />
            <div className="flex justify-center mb-3">{s.icon}</div>
            <p className="text-3xl font-extrabold text-foreground text-center">{s.value}</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-1 text-center uppercase tracking-wide">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Per-course breakdown */}
      {courseStats.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={5}>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 flex items-center gap-2">
            <span className="w-5 h-px bg-emerald-600 inline-block" /> Breakdown
          </p>
          <h2 className="font-heading text-3xl text-foreground tracking-tight mt-2 mb-6">Course Performance</h2>
          <div className="space-y-4">
            {courseStats.map((cs, i) => (
              <motion.div key={cs.course.id} variants={fadeUp} initial="hidden" animate="visible" custom={6 + i}
                className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-[15px]">{cs.course.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cs.course.subject}</p>
                    </div>
                  </div>
                  <Badge className={`rounded-full text-[10px] shrink-0 font-bold ${cs.course.status === 'published' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
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
                    <div key={j} className="bg-muted/50 rounded-2xl p-3.5 text-center">
                      <p className="text-xl font-extrabold text-foreground">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-wide">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Recent quiz submissions */}
      {recentSubmissions.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={7 + courseStats.length}>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 flex items-center gap-2">
            <span className="w-5 h-px bg-emerald-600 inline-block" /> Activity
          </p>
          <h2 className="font-heading text-3xl text-foreground tracking-tight mt-2 mb-6">Recent Submissions</h2>
          <div className="space-y-3">
            {recentSubmissions.map((sub, i) => (
              <motion.div key={sub.id} variants={fadeUp} initial="hidden" animate="visible" custom={8 + courseStats.length + i}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub.studentName || 'Student'}</p>
                </div>
                <div className="text-right shrink-0">
                  {sub.score !== undefined ? (
                    <span className={`text-sm font-bold ${(sub.score / sub.maxScore) >= 0.7 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {sub.score}/{sub.maxScore}
                    </span>
                  ) : (
                    <Badge className="rounded-full bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">Needs grading</Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Empty state */}
      {courseStats.length === 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="text-center py-20">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 blur-2xl bg-emerald-400/20 rounded-full scale-150" />
            <BarChart3 className="w-14 h-14 text-muted-foreground/40 relative" />
          </div>
          <h3 className="font-heading text-2xl text-foreground">No analytics yet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Create and publish courses to start seeing student data here.</p>
        </motion.div>
      )}
    </div>
  );
}
