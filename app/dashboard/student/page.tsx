'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getUserBadges, Course, Enrollment, Badge } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, BookOpen, Zap, Trophy, Target, TrendingUp, Sparkles, Users, GraduationCap, Play } from 'lucide-react';
import Link from 'next/link';

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
  const level = Math.floor(xp / xpToNextLevel) + 1;
  const xpProgress = Math.min((xp % xpToNextLevel) / xpToNextLevel * 100, 100);
  const inProgress = enrolled.filter(e => e.enrollment.progress > 0 && e.enrollment.progress < 100);
  const notStarted = enrolled.filter(e => e.enrollment.progress === 0);
  const completed = enrolled.filter(e => e.enrollment.progress === 100);
  const resumeCourse = inProgress[0] ?? notStarted[0];
  const firstName = profile?.name?.split(' ')[0] ?? 'Student';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* ── Greeting ── */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0} className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary flex items-center gap-2">
          <span className="w-5 h-px bg-primary inline-block" /> {greeting()} · {today}
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          Welcome back, <span className="gradient-text italic">{firstName}</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">Here's where your learning journey stands today.</p>
      </motion.header>

      {/* ── Bento hero ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Level / XP hero card */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="lg:col-span-2 c5-animated-gradient rounded-[2rem] p-7 sm:p-9 text-white relative overflow-hidden shadow-[0_24px_60px_-16px_rgba(26,115,232,0.45)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_100%_0%,transparent_40%,rgba(7,11,20,0.35)_100%)]" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-8 h-full">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">Your standing</p>
              <p className="font-heading text-5xl sm:text-6xl mt-2 leading-none">Level {level}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-sm">
                <span className="flex items-center gap-1.5 font-semibold"><Zap className="w-4 h-4 text-amber-300" /> {xp.toLocaleString()} XP</span>
                <span className="flex items-center gap-1.5 font-semibold"><Trophy className="w-4 h-4 text-amber-300" /> {badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1.5 font-semibold"><BookOpen className="w-4 h-4 text-white/80" /> {enrolled.length} course{enrolled.length !== 1 ? 's' : ''}</span>
              </div>
              {resumeCourse && (
                <Button
                  onClick={() => router.push(`/dashboard/student/courses/${resumeCourse.course.id}`)}
                  className="mt-7 h-11 px-5 rounded-full bg-white text-[#1A73E8] hover:bg-white/90 font-bold text-sm gap-2 shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" /> Resume {resumeCourse.course.title.length > 24 ? resumeCourse.course.title.slice(0, 24) + '…' : resumeCourse.course.title}
                </Button>
              )}
            </div>
            <div className="relative shrink-0 self-center">
              <ProgressRing value={xpProgress} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-2xl leading-none">{Math.round(xpProgress)}%</span>
                <span className="text-[10px] uppercase tracking-wider text-white/70 mt-1">to Lv {level + 1}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* AI quick access stack */}
        <div className="flex flex-col gap-5">
          <motion.button variants={fadeUp} initial="hidden" animate="visible" custom={2}
            onClick={() => router.push('/ai-studio')}
            className="flex-1 group relative bg-[#070B14] rounded-[2rem] p-6 text-left overflow-hidden border border-white/[0.06] hover:border-[#1A73E8]/40 transition-colors min-h-[120px]"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#1A73E8]/25 blur-[60px] group-hover:bg-[#1A73E8]/40 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shadow-[0_0_20px_rgba(26,115,232,0.4)]">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <p className="font-heading text-xl text-white mt-4">AI Studio</p>
              <p className="text-[13px] text-slate-400 mt-1">Generate lessons, quizzes & flashcards from anything.</p>
            </div>
          </motion.button>

          <motion.button variants={fadeUp} initial="hidden" animate="visible" custom={3}
            onClick={() => router.push('/ai-teachers')}
            className="flex-1 group relative bg-[#070B14] rounded-[2rem] p-6 text-left overflow-hidden border border-white/[0.06] hover:border-[#7C3AED]/40 transition-colors min-h-[120px]"
          >
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-[#7C3AED]/25 blur-[60px] group-hover:bg-[#7C3AED]/40 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)]">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <p className="font-heading text-xl text-white mt-4">AI Teachers</p>
              <p className="text-[13px] text-slate-400 mt-1">Live 1-on-1 sessions with expert AI tutors.</p>
            </div>
          </motion.button>
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'In Progress', value: inProgress.length, icon: TrendingUp, accent: 'text-[#1A73E8]', bar: 'bg-[#1A73E8]' },
          { label: 'Completed', value: completed.length, icon: GraduationCap, accent: 'text-emerald-600', bar: 'bg-emerald-500' },
          { label: 'Badges Earned', value: badges.length, icon: Trophy, accent: 'text-amber-600', bar: 'bg-amber-500' },
        ].map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} initial="hidden" animate="visible" custom={4 + i}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
          >
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${s.bar} opacity-80`} />
            <s.icon className={`w-5 h-5 ${s.accent}`} />
            <p className="font-heading text-4xl sm:text-5xl text-foreground mt-3 leading-none">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Continue learning ── */}
      {inProgress.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Pick up where you left off</p>
              <h2 className="font-heading text-3xl text-foreground mt-1.5">Continue learning</h2>
            </div>
            <Link href="/dashboard/student/courses" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1 shrink-0 pb-1">
              All courses <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {inProgress.slice(0, 4).map(({ course, enrollment }, i) => (
              <motion.div key={course.id} variants={fadeUp} initial="hidden" animate="visible" custom={8 + i}
                className="group bg-card border border-border rounded-3xl overflow-hidden cursor-pointer card-glow"
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
              >
                <div className={`h-24 bg-gradient-to-br ${COURSE_GRADIENTS[i % COURSE_GRADIENTS.length]} relative overflow-hidden`}>
                  <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/15" />
                  <div className="absolute right-10 bottom-2 w-14 h-14 rounded-full bg-white/10" />
                  <span className="absolute left-5 bottom-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{course.subject ?? 'Course'}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-foreground text-lg leading-snug group-hover:text-primary transition-colors line-clamp-1">{course.title}</h3>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${COURSE_GRADIENTS[i % COURSE_GRADIENTS.length]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${enrollment.progress}%` }}
                        transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="font-heading text-lg text-foreground leading-none shrink-0">{enrollment.progress}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5 font-medium group-hover:text-primary transition-colors">
                    Continue <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Start something new ── */}
      {notStarted.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={10}>
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Fresh starts</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">Start something new</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {notStarted.map(({ course }, i) => (
              <motion.div key={course.id} variants={fadeUp} initial="hidden" animate="visible" custom={11 + i}
                className="group bg-card border border-border rounded-3xl p-5 cursor-pointer card-glow"
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
              >
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${COURSE_GRADIENTS[(i + 1) % COURSE_GRADIENTS.length]} flex items-center justify-center mb-4 shadow-md`}>
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{course.title}</h3>
                <p className="text-[13px] text-muted-foreground line-clamp-2 mt-1.5">{course.description}</p>
                <span className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  Not started
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Empty state ── */}
      {enrolled.length === 0 && !loading && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="relative text-center py-20 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#1A73E8]/8 blur-[80px]" />
          <Target className="w-12 h-12 text-primary/40 mx-auto mb-5" />
          <h3 className="font-heading text-3xl text-foreground mb-2">Your journey starts here</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">Browse the marketplace or ask your admin to seed the demo courses to begin learning.</p>
          <Button onClick={() => router.push('/courses')} className="mt-6 rounded-full h-11 px-6 bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white font-bold gap-2">
            Explore Marketplace <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {loading && (
        <div className="space-y-5">
          <div className="h-56 bg-muted animate-pulse rounded-[2rem]" />
          <div className="grid grid-cols-3 gap-5">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-3xl" />)}</div>
        </div>
      )}
    </div>
  );
}
