'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getUserBadges, Course, Enrollment, Badge } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, BookOpen, Zap, Trophy, Target, TrendingUp, Sparkles, Users, GraduationCap, Play } from 'lucide-react';
import Link from 'next/link';
import {
  DashPage, DashHeader, Panel, PanelHeader, StatCard, ProgressBar,
  ListRow, Initials, EmptyState,
} from '@/components/dash-ui';

interface CourseWithEnrollment { course: Course; enrollment: Enrollment }

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const COURSE_GRADIENTS = [
  'from-[#1A73E8] to-[#7C3AED]',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-fuchsia-600',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function ProgressRing({ value, size = 116, stroke = 9 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * Math.min(value, 100)) / 100 }}
        transition={{ duration: 1.4, ease: [0.21, 0.6, 0.35, 1], delay: 0.4 }}
      />
    </svg>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [enrolled, setEnrolled] = useState<CourseWithEnrollment[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [courses, bs] = await Promise.all([
        getEnrolledCourses(user.uid),
        getUserBadges(user.uid),
      ]);
      setEnrolled(courses);
      setBadges(bs);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const xp = profile?.xp ?? 0;
  const xpToNextLevel = 1000;
  const level = Math.floor(xp / xpToNextLevel) + 1;
  const xpProgress = Math.min((xp % xpToNextLevel) / xpToNextLevel * 100, 100);
  const inProgress = enrolled.filter(e => e.enrollment.progress > 0 && e.enrollment.progress < 100);
  const notStarted = enrolled.filter(e => e.enrollment.progress === 0);
  const completed = enrolled.filter(e => e.enrollment.progress === 100);
  const resumeCourse = inProgress[0] ?? notStarted[0];
  const firstName = profile?.name?.split(' ')[0] ?? 'Student';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  const overallProgress = enrolled.length
    ? enrolled.reduce((n, e) => n + e.enrollment.progress, 0) / enrolled.length
    : 0;

  if (loading) return (
    <DashPage>
      <div className="h-16 bg-muted animate-pulse rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}
      </div>
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="h-80 bg-muted animate-pulse rounded-2xl" />
        <div className="h-80 bg-muted animate-pulse rounded-2xl" />
      </div>
    </DashPage>
  );

  return (
    <DashPage>
      <DashHeader
        eyebrow={`${greeting()} · ${today}`}
        title="Welcome back,"
        accent={firstName}
        description="Here's where your learning stands today."
        actions={resumeCourse ? (
          <Button
            onClick={() => router.push(`/dashboard/student/courses/${resumeCourse.course.id}`)}
            className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Resume learning
          </Button>
        ) : (
          <Button onClick={() => router.push('/courses')} className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2">
            Browse courses <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      />

      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0} icon={BookOpen} label="Enrolled courses" value={enrolled.length}
          badge={inProgress.length ? 'Active' : undefined}
          progress={overallProgress} progressLabel="Overall progress"
        />
        <StatCard
          index={1} icon={TrendingUp} label="In progress" value={inProgress.length}
          href="/dashboard/student/courses" hrefLabel="View all"
        />
        <StatCard
          index={2} icon={GraduationCap} label="Completed" value={completed.length}
          href="/dashboard/student/transcript" hrefLabel="View transcript"
        />
        <StatCard
          index={3} icon={Zap} label="Level" value={`Lv ${level}`}
          progress={xpProgress} progressLabel={`${xp.toLocaleString()} XP`}
        />
      </div>

      {/* ── Continue learning + side rail ── */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Panel>
          <PanelHeader
            title="Continue learning"
            action={
              <Link href="/dashboard/student/courses"
                className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
                All courses <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          {inProgress.length === 0 && notStarted.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Your journey starts here"
              body="Browse the marketplace to enrol in your first course."
              action={
                <Button onClick={() => router.push('/courses')} className="h-9 px-4 rounded-xl text-[13px] font-semibold gap-2">
                  Explore marketplace <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {[...inProgress, ...notStarted].slice(0, 5).map(({ course, enrollment }) => (
                <ListRow
                  key={course.id}
                  href={`/dashboard/student/courses/${course.id}`}
                  leading={<Initials name={course.subject || course.title} />}
                  title={course.title}
                  subtitle={course.subject ?? 'Course'}
                  trailing={
                    <div className="w-28">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">
                          {enrollment.progress === 0 ? 'Not started' : 'Progress'}
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{enrollment.progress}%</span>
                      </div>
                      <ProgressBar value={enrollment.progress} />
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Jump back in" />
            <div className="space-y-2">
              <ListRow
                href="/ai-studio"
                leading={<span className="w-9 h-9 rounded-xl bg-secondary grid place-items-center shrink-0"><Sparkles className="w-4 h-4 text-primary" /></span>}
                title="AI Studio"
                subtitle="Turn notes into study material"
                trailing={<ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
              />
              <ListRow
                href="/ai-teachers"
                leading={<span className="w-9 h-9 rounded-xl bg-secondary grid place-items-center shrink-0"><Users className="w-4 h-4 text-primary" /></span>}
                title="AI Teachers"
                subtitle="Chat or talk live with a tutor"
                trailing={<ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
              />
              <ListRow
                href="/dashboard/student/tasks"
                leading={<span className="w-9 h-9 rounded-xl bg-secondary grid place-items-center shrink-0"><Target className="w-4 h-4 text-primary" /></span>}
                title="Daily goals"
                subtitle="Set today's plan and earn Sparks"
                trailing={<ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Achievements"
              meta={<span className="text-[11px] text-muted-foreground">{badges.length} earned</span>}
            />
            {badges.length === 0 ? (
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Finish a lesson or a daily goal to earn your first badge.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.slice(0, 8).map(b => (
                  <span key={b.id}
                    className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-xl border border-border text-[12px] font-medium text-foreground">
                    <Trophy className="w-3.5 h-3.5 text-primary" />{b.name ?? 'Badge'}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </DashPage>
  );
}
