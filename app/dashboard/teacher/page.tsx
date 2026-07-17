'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, getSubmissionsForTeacher, Course, Submission } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { BookOpen, ClipboardList, ArrowRight, ArrowUpRight, Upload, BarChart3, CheckCircle2, Sparkles, GraduationCap } from 'lucide-react';
import Link from 'next/link';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const COURSE_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-[#1A73E8] to-[#7C3AED]',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState(false);

  const load = () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([getTeacherCourses(user.uid), getSubmissionsForTeacher(user.uid)]).then(([cs, ss]) => {
      setCourses(cs);
      setSubmissions(ss);
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user]);

  const ungraded = submissions.filter(s => s.score === undefined);
  const published = courses.filter(c => c.status === 'published');
  const firstName = profile?.name?.split(' ')[0] ?? 'Teacher';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <BookOpen className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load your dashboard</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your data. Please try again.</p>
        <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={load}>Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* ── Greeting ── */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col lg:flex-row lg:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 flex items-center gap-2">
            <span className="w-5 h-px bg-emerald-600 inline-block" /> {greeting()} · {today}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            Your classroom, <span className="gradient-text italic">{firstName}</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">
            {ungraded.length > 0
              ? `${ungraded.length} submission${ungraded.length !== 1 ? 's' : ''} waiting for your review.`
              : 'Everything is graded — here’s your teaching at a glance.'}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button variant="outline" className="rounded-full h-11 px-5 gap-2 font-semibold" onClick={() => router.push('/dashboard/teacher/upload')}>
            <Upload className="w-4 h-4" /> Create Lesson
          </Button>
          <Button className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white" onClick={() => router.push('/dashboard/teacher/gradebook')}>
            <ClipboardList className="w-4 h-4" /> Gradebook
          </Button>
        </div>
      </motion.header>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'My Courses', value: courses.length, icon: BookOpen, accent: 'text-[#1A73E8]', bar: 'bg-[#1A73E8]' },
          { label: 'Published', value: published.length, icon: GraduationCap, accent: 'text-emerald-600', bar: 'bg-emerald-500' },
          { label: 'To Grade', value: ungraded.length, icon: ClipboardList, accent: 'text-amber-600', bar: 'bg-amber-500' },
          { label: 'Submissions', value: submissions.length, icon: CheckCircle2, accent: 'text-violet-600', bar: 'bg-violet-500' },
        ].map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} initial="hidden" animate="visible" custom={1 + i}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
          >
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${s.bar} opacity-80`} />
            <s.icon className={`w-5 h-5 ${s.accent}`} />
            <p className="font-heading text-4xl sm:text-5xl text-foreground mt-3 leading-none">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Needs attention ── */}
      {ungraded.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={5}
          className="relative bg-card border border-amber-500/30 rounded-[2rem] p-6 sm:p-8 overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-400/10 blur-[60px]" />
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600">Needs your attention</p>
              <h2 className="font-heading text-3xl text-foreground mt-1.5">Pending grades</h2>
            </div>
            <Link href="/dashboard/teacher/gradebook" className="text-sm text-amber-600 font-semibold hover:underline flex items-center gap-1 shrink-0 pb-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3 relative">
            {ungraded.slice(0, 3).map((sub) => (
              <div key={sub.id} className="bg-background/60 backdrop-blur border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-amber-500/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
                  {(sub.studentName || 'S').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub.studentName || 'Student'} · Quiz · {sub.answers.filter(a => a.correct).length}/{sub.maxScore} correct</p>
                </div>
                <Button size="sm" className="rounded-full px-4 shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => router.push('/dashboard/teacher/gradebook')}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── My Courses ── */}
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={6}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Your catalogue</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">My courses</h2>
          </div>
          <Link href="/dashboard/teacher/upload" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1 shrink-0 pb-1">
            + New lesson <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-5">{[1, 2].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />)}</div>
        ) : courses.length === 0 ? (
          <div className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden">
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/8 blur-[80px]" />
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-emerald-600/40" />
            <h3 className="font-heading text-2xl text-foreground mb-2">No courses yet</h3>
            <p className="text-muted-foreground text-sm">Use Create Lesson to build and publish your first course.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {courses.map((course, i) => (
              <motion.div key={course.id} variants={fadeUp} initial="hidden" animate="visible" custom={7 + i}
                className="group bg-card border border-border rounded-3xl overflow-hidden cursor-pointer card-glow"
                onClick={() => router.push('/dashboard/teacher/courses')}
              >
                <div className={`h-20 bg-gradient-to-br ${COURSE_GRADIENTS[i % COURSE_GRADIENTS.length]} relative overflow-hidden`}>
                  <div className="absolute -right-6 -top-8 w-24 h-24 rounded-full bg-white/15" />
                  <span className={`absolute right-4 bottom-3 text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full backdrop-blur ${course.status === 'published' ? 'bg-white/25 text-white' : 'bg-black/25 text-white/90'}`}>
                    {course.status === 'published' ? 'Published' : course.status === 'pending_approval' ? 'In review' : 'Draft'}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-foreground text-lg leading-snug group-hover:text-primary transition-colors line-clamp-1">{course.title}</h3>
                  <p className="text-[13px] text-muted-foreground line-clamp-2 mt-1.5">{course.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Power tools ── */}
      <div className="grid sm:grid-cols-2 gap-5">
        {[
          { icon: Sparkles, title: 'AI Studio', desc: 'Turn any material into 11 lesson formats in seconds.', href: '/ai-studio', glow: 'bg-[#1A73E8]/25', iconBg: 'from-[#1A73E8] to-[#7C3AED]' },
          { icon: BarChart3, title: 'Student Analytics', desc: 'Track performance and spot struggling students early.', href: '/dashboard/teacher/analytics', glow: 'bg-emerald-500/25', iconBg: 'from-emerald-500 to-teal-600' },
        ].map((item, i) => (
          <motion.button key={item.title} variants={fadeUp} initial="hidden" animate="visible" custom={9 + i}
            onClick={() => router.push(item.href)}
            className="group relative bg-[#070B14] rounded-[2rem] p-7 text-left overflow-hidden border border-white/[0.06] hover:border-white/[0.15] transition-colors"
          >
            <div className={`absolute -top-12 -right-12 w-44 h-44 rounded-full ${item.glow} blur-[60px] group-hover:scale-125 transition-transform duration-500`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${item.iconBg} flex items-center justify-center shadow-lg`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <p className="font-heading text-2xl text-white mt-5">{item.title}</p>
              <p className="text-[13px] text-slate-400 mt-1.5">{item.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
