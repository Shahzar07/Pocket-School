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
import { Progress } from '@/components/ui/progress';
import { Zap, BookOpen, MessageSquare, Trophy, UserRound, FileBarChart } from 'lucide-react';
import Link from 'next/link';

interface ChildData {
  id: string;
  profile: UserProfile;
  enrollments: { course: Course; enrollment: Enrollment }[];
  unitReports: UnitReportData[];
}

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

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1, 2].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-3xl text-foreground tracking-tight">Parent Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor your child's progress and achievements.</p>
        </div>
        <Link href="/dashboard/parent/communications" className={buttonVariants({ variant: 'outline' }) + ' rounded-xl gap-2'}>
          <MessageSquare className="w-4 h-4" /> Messages
        </Link>
      </motion.div>

      {children.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed border-border">
          <UserRound className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-muted-foreground">No linked children yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Link your child's account via profile settings or during onboarding.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {children.map(({ id, profile: childProfile, enrollments, unitReports }, ci) => {
            const xp = childProfile.xp ?? 0;
            // Use `progress` field (0–100) — completedAt does not exist in Enrollment
            const completed = enrollments.filter(e => e.enrollment.progress === 100);
            const inProgress = enrollments.filter(e => e.enrollment.progress > 0 && e.enrollment.progress < 100);

            return (
              <motion.div key={id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.1 }}
                className="bg-card border border-border rounded-3xl overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 border-2 border-white/40">
                      <AvatarFallback className="bg-white/20 text-white font-bold text-xl">
                        {childProfile.name?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h2 className="font-heading text-2xl">{childProfile.name}</h2>
                      <p className="text-blue-200 text-sm capitalize">
                        {childProfile.level || 'Student'} · {childProfile.learningStyle || 'Visual'} learner
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-yellow-300 font-bold text-lg">
                        <Zap className="w-5 h-5" />{xp.toLocaleString()} XP
                      </div>
                      <p className="text-blue-200 text-xs mt-0.5">{enrollments.length} courses enrolled</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  {[
                    { label: 'Enrolled', value: enrollments.length, icon: <BookOpen className="w-4 h-4 text-blue-500" /> },
                    { label: 'In Progress', value: inProgress.length, icon: <Zap className="w-4 h-4 text-amber-500" /> },
                    { label: 'Completed', value: completed.length, icon: <Trophy className="w-4 h-4 text-emerald-500" /> },
                  ].map((s, i) => (
                    <div key={i} className="p-4 text-center">
                      <div className="flex justify-center mb-1">{s.icon}</div>
                      <p className="font-heading text-2xl text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Unit mastery report cards */}
                {unitReports.length > 0 && (
                  <div className="p-6 border-b border-border space-y-4">
                    <div className="flex items-center gap-2">
                      <FileBarChart className="w-4 h-4 text-blue-600" />
                      <h3 className="font-bold text-foreground text-sm">Unit Report Cards</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {unitReports.map(report => (
                        <UnitReportCard key={`${report.courseId}-${report.unitId}`} report={report} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <h3 className="font-bold text-foreground text-sm">Course Progress</h3>
                  {enrollments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not enrolled in any courses yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {enrollments.map(({ course, enrollment }) => {
                        const pct = enrollment.progress ?? 0;
                        const done = enrollment.completedLessons?.length ?? 0;
                        return (
                          <div key={course.id}>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-sm font-semibold text-foreground truncate max-w-[65%]">{course.title}</p>
                              <span className="text-xs text-muted-foreground">{done} lessons done</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">{pct}% complete</p>
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
