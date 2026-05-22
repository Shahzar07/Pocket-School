'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getUserBadges, Course, Enrollment, Badge } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { ArrowRight, BookOpen, Zap, Trophy, Star, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface CourseWithEnrollment { course: Course; enrollment: Enrollment }

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: i * 0.07 } }),
};

export default function StudentDashboard() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [enrolled, setEnrolled] = useState<CourseWithEnrollment[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getEnrolledCourses(user.uid),
      getUserBadges(user.uid),
    ]).then(([courses, bs]) => {
      setEnrolled(courses);
      setBadges(bs);
      setLoading(false);
    });
  }, [user]);

  const xp = profile?.xp ?? 0;
  const xpToNextLevel = 1000;
  const xpProgress = Math.min((xp % xpToNextLevel) / xpToNextLevel * 100, 100);
  const inProgress = enrolled.filter(e => e.enrollment.progress > 0 && e.enrollment.progress < 100);
  const notStarted = enrolled.filter(e => e.enrollment.progress === 0);
  const completed = enrolled.filter(e => e.enrollment.progress === 100);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-7 text-white relative overflow-hidden"
      >
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10">
          <p className="text-blue-100 text-sm font-medium mb-1">Welcome back</p>
          <h1 className="font-heading text-3xl sm:text-4xl tracking-tight mb-4">
            {profile?.name?.split(' ')[0] ?? 'Student'} 👋
          </h1>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-300" /><span className="font-bold text-lg">{xp.toLocaleString()} XP</span></div>
            <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-300" /><span className="font-bold">{badges.length} Badge{badges.length !== 1 ? 's' : ''}</span></div>
            <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-200" /><span className="font-semibold">{enrolled.length} Course{enrolled.length !== 1 ? 's' : ''}</span></div>
          </div>
          <div className="mt-4 max-w-xs">
            <div className="flex justify-between text-xs text-blue-100 mb-1.5">
              <span>Level Progress</span><span>{xp % xpToNextLevel}/{xpToNextLevel} XP</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'In Progress', value: inProgress.length, icon: <TrendingUp className="w-5 h-5 text-blue-500" />, color: 'bg-blue-50 border-blue-200' },
          { label: 'Completed', value: completed.length, icon: <Star className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50 border-amber-200' },
          { label: 'Badges Earned', value: badges.length, icon: <Trophy className="w-5 h-5 text-violet-500" />, color: 'bg-violet-50 border-violet-200' },
        ].map((s, i) => (
          <motion.div key={i} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}
            className={`${s.color} border rounded-2xl p-4 text-center`}
          >
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="font-heading text-2xl text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {inProgress.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Continue Learning</h2>
            <Link href="/dashboard/student/courses" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              All courses <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {inProgress.slice(0, 2).map(({ course, enrollment }, i) => (
              <motion.div key={course.id} variants={fadeUp} initial="hidden" animate="visible" custom={5 + i}
                className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{course.title}</h3>
                    <p className="text-xs text-muted-foreground">{course.subject}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span><span className="font-semibold text-foreground">{enrollment.progress}%</span>
                  </div>
                  <Progress value={enrollment.progress} className="h-1.5" />
                </div>
                <Button size="sm" className="mt-4 w-full rounded-xl h-9 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-semibold">
                  Continue <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {notStarted.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <h2 className="text-lg font-bold text-foreground mb-4">Start Something New</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notStarted.map(({ course }, i) => (
              <motion.div key={course.id} variants={fadeUp} initial="hidden" animate="visible" custom={8 + i}
                className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{course.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
                <BadgeUI className="rounded-full text-xs bg-muted text-muted-foreground">Not started</BadgeUI>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {enrolled.length === 0 && !loading && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed border-border"
        >
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">No courses yet</h3>
          <p className="text-muted-foreground text-sm">Ask your admin to seed the demo courses from the admin dashboard.</p>
        </motion.div>
      )}

      {loading && <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}</div>}
    </div>
  );
}
