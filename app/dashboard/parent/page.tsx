'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getChildrenProfiles, getEnrolledCourses, getUnitQuizAttempts, getModulesWithLessons,
  UserProfile, Course, Enrollment,
} from '@/lib/db';
import { UnitReportCard, UnitReportData } from '@/components/unit-report-card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { Zap, BookOpen, MessageSquare, Trophy, UserRound, FileBarChart, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface ChildData {
  id: string;
  profile: UserProfile;
  enrollments: { course: Course; enrollment: Enrollment }[];
  unitReports: UnitReportData[];
}

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

async function buildUnitReports(
  childId: string,
  enrollments: { course: Course; enrollment: Enrollment }[]
): Promise<UnitReportData[]> {
  const attempts = await getUnitQuizAttempts(childId);
  if (attempts.length === 0) return [];

  const reports: UnitReportData[] = [];
  const courseIds = [...new Set(attempts.map(a => a.courseId))];
  for (const courseId of courseIds) {
    const course = enrollments.find(e => e.course.id === courseId)?.course;
    const units = await getModulesWithLessons(courseId);
    const courseAttempts = attempts.filter(a => a.courseId === courseId);
    const unitIds = [...new Set(courseAttempts.map(a => a.unitId))];
    for (const unitId of unitIds) {
      const unit = units.find(u => u.module.id === unitId);
      const unitAttempts = courseAttempts
        .filter(a => a.unitId === unitId)
        .sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0));
      const latest = unitAttempts[0];
      const lessonById = new Map((unit?.lessons ?? []).map(l => [l.id, l]));
      reports.push({
        courseId,
        courseTitle: course?.title ?? 'Course',
        unitId,
        unitTitle: unit?.module.title ?? 'Unit',
        masteryThreshold: unit?.module.masteryThreshold ?? 70,
        attempts: unitAttempts,
        reviewLessons: (latest.recommendedLessonIds ?? [])
          .map(id => lessonById.get(id))
          .filter((l): l is NonNullable<typeof l> => !!l)
          .map(l => ({ id: l.id, title: l.title, lessonNumber: l.lessonNumber })),
      });
    }
  }
  return reports;
}

export default function ParentDashboard() {
  const { user } = useAuthSTORE();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getChildrenProfiles(user.uid).then(async (childProfiles) => {
      const data: ChildData[] = await Promise.all(
        childProfiles.map(async ({ id, data }) => {
          const enrollments = await getEnrolledCourses(id);
          const unitReports = await buildUnitReports(id, enrollments).catch(() => []);
          return { id, profile: data, enrollments, unitReports };
        })
      );
      setChildren(data);
      setLoading(false);
    });
  }, [user]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      {[1, 2].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-[2rem]" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* ── Greeting ── */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600 flex items-center gap-2">
            <span className="w-5 h-px bg-amber-600 inline-block" /> Family overview · {today}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            Your family's <span className="gradient-text italic">progress</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Every lesson, score, and milestone — in one place.</p>
        </div>
        <Link href="/dashboard/parent/communications"
          className={buttonVariants({ variant: 'outline' }) + ' rounded-full h-11 px-5 gap-2 font-semibold shrink-0'}
        >
          <MessageSquare className="w-4 h-4" /> Message teachers
        </Link>
      </motion.header>

      {children.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="relative text-center py-20 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/8 blur-[80px]" />
          <UserRound className="w-12 h-12 mx-auto mb-5 text-amber-600/40" />
          <h3 className="font-heading text-3xl text-foreground mb-2">No linked children yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Link your child's account via profile settings or during onboarding to see their progress here.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-10">
          {children.map(({ id, profile: childProfile, enrollments, unitReports }, ci) => {
            const xp = childProfile.xp ?? 0;
            const completed = enrollments.filter(e => e.enrollment.progress === 100);
            const inProgress = enrollments.filter(e => e.enrollment.progress > 0 && e.enrollment.progress < 100);

            return (
              <motion.div key={id} variants={fadeUp} initial="hidden" animate="visible" custom={1 + ci}
                className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-[0_8px_40px_-12px_rgba(15,23,42,0.08)]"
              >
                {/* Child hero band */}
                <div className="relative bg-[#070B14] p-7 sm:p-8 text-white overflow-hidden">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-[#1A73E8]/25 blur-[80px]" />
                    <div className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-[#7C3AED]/20 blur-[80px]" />
                  </div>
                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                    <Avatar className="w-16 h-16 border-2 border-white/20 shadow-[0_0_30px_rgba(26,115,232,0.35)] shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] text-white font-bold text-2xl">
                        {childProfile.name?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-heading text-3xl sm:text-4xl leading-tight">{childProfile.name}</h2>
                      <p className="text-slate-400 text-sm capitalize mt-1">
                        {childProfile.level || 'Student'} · {childProfile.learningStyle || 'Visual'} learner
                      </p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <div className="flex sm:justify-end items-center gap-2 text-amber-300">
                        <Zap className="w-5 h-5 fill-amber-300" />
                        <span className="font-heading text-3xl leading-none">{xp.toLocaleString()}</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300/70 mt-1">XP</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1.5">{enrollments.length} course{enrollments.length !== 1 ? 's' : ''} enrolled</p>
                    </div>
                  </div>
                </div>

                {/* Stats band */}
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/30">
                  {[
                    { label: 'Enrolled', value: enrollments.length, icon: BookOpen, accent: 'text-[#1A73E8]' },
                    { label: 'In Progress', value: inProgress.length, icon: TrendingUp, accent: 'text-amber-600' },
                    { label: 'Completed', value: completed.length, icon: Trophy, accent: 'text-emerald-600' },
                  ].map((s) => (
                    <div key={s.label} className="p-5 text-center">
                      <s.icon className={`w-4 h-4 mx-auto ${s.accent}`} />
                      <p className="font-heading text-3xl sm:text-4xl text-foreground mt-2 leading-none">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-1.5 font-semibold uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Unit mastery report cards */}
                {unitReports.length > 0 && (
                  <div className="p-6 sm:p-7 border-b border-border space-y-4">
                    <div className="flex items-center gap-2">
                      <FileBarChart className="w-4 h-4 text-primary" />
                      <h3 className="font-heading text-xl text-foreground">Module report cards</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {unitReports.map(report => (
                        <UnitReportCard key={`${report.courseId}-${report.unitId}`} report={report} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Course progress */}
                <div className="p-6 sm:p-7 space-y-5">
                  <h3 className="font-heading text-xl text-foreground">Course progress</h3>
                  {enrollments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not enrolled in any courses yet.</p>
                  ) : (
                    <div className="space-y-5">
                      {enrollments.map(({ course, enrollment }, i) => {
                        const pct = enrollment.progress ?? 0;
                        const done = enrollment.completedLessons?.length ?? 0;
                        return (
                          <div key={course.id}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-foreground truncate max-w-[60%]">{course.title}</p>
                              <span className="text-xs text-muted-foreground font-medium">{done} lesson{done !== 1 ? 's' : ''} done · <span className="font-heading text-base text-foreground">{pct}%</span></span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-[#1A73E8] to-[#7C3AED]"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
