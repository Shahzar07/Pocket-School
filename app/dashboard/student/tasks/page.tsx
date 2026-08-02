'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  subscribeDailyGoals, createDailyGoal, deleteDailyGoal, startDailyGoal, completeDailyGoal,
  computeGoalStreak, checkGoalAlerts, goalDateKey, getEnrolledCourses,
  DailyGoal, GoalCategory, Course, Enrollment,
} from '@/lib/db';
import { DailyGoalsModal } from '@/components/daily-goals-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Target, Play, Check, Flame, Clock, Lock,
  Sparkles, CalendarDays, LineChart, CheckCircle2, AlertTriangle, ShieldCheck,
} from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const CATEGORY_META: Record<GoalCategory, { label: string; pill: string; dot: string }> = {
  study:    { label: 'Study',    pill: 'bg-[#1A73E8]/10 text-[#1A73E8]',   dot: 'bg-[#1A73E8]' },
  revision: { label: 'Revision', pill: 'bg-[#7C3AED]/10 text-[#7C3AED]',   dot: 'bg-[#7C3AED]' },
  practice: { label: 'Practice', pill: 'bg-amber-500/10 text-amber-600',   dot: 'bg-amber-500' },
  reading:  { label: 'Reading',  pill: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
  other:    { label: 'Other',    pill: 'bg-muted text-muted-foreground',   dot: 'bg-muted-foreground' },
};

const CATEGORY_ORDER: GoalCategory[] = ['study', 'revision', 'practice', 'reading', 'other'];
const ESTIMATE_OPTIONS = [15, 30, 45, 60, 90];

type DisplayStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'excused';

const STATUS_META: Record<DisplayStatus, { label: string; pill: string }> = {
  not_started: { label: 'Not Started', pill: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', pill: 'bg-[#1A73E8]/10 text-[#1A73E8]' },
  completed:   { label: 'Completed',   pill: 'bg-emerald-500/10 text-emerald-600' },
  overdue:     { label: 'Overdue',     pill: 'bg-destructive/10 text-destructive' },
  excused:     { label: 'Excused',     pill: 'bg-amber-500/10 text-amber-600' },
};

/** Parse an 'HH:mm' deadline into a Date on the goal's own day. */
function deadlineDate(goal: DailyGoal): Date {
  const [y, m, d] = (goal.dateKey || goalDateKey()).split('-').map(Number);
  const [h, min] = (goal.deadline || '23:59').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 23, min || 59, 0, 0);
}

function displayStatus(goal: DailyGoal, nowMs: number): DisplayStatus {
  if (goal.status === 'completed') return 'completed';
  if (goal.status === 'excused') return 'excused';
  if (nowMs > deadlineDate(goal).getTime()) return 'overdue';
  return goal.status === 'in_progress' ? 'in_progress' : 'not_started';
}

/** Remaining seconds against the student's own estimate — powers the ring. */
function goalTiming(goal: DailyGoal, nowMs: number) {
  const totalSec = Math.max(60, (goal.estimateMinutes || 30) * 60);
  if (goal.status === 'completed' || goal.status === 'excused') return { totalSec, remainingSec: 0, done: true };
  const startedMs = goal.startedAt?.toMillis?.();
  if (goal.status === 'in_progress' && startedMs) {
    return { totalSec, remainingSec: Math.max(0, totalSec - Math.floor((nowMs - startedMs) / 1000)), done: false };
  }
  return { totalSec, remainingSec: totalSec, done: false };
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDeadline(hhmm: string) {
  const [h, m] = (hhmm || '23:59').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Circular countdown ring — turns red with under 15 minutes left. */
function CountdownRing({ goal, nowMs }: { goal: DailyGoal; nowMs: number }) {
  const { totalSec, remainingSec, done } = goalTiming(goal, nowMs);
  const R = 20;
  const C = 2 * Math.PI * R;
  // Ring depletes as the estimate is used up; a finished goal shows a full ring.
  const elapsedFrac = done ? 0 : Math.min(1, Math.max(0, 1 - remainingSec / totalSec));
  const urgent = !done && remainingSec <= 15 * 60;
  const stroke = done ? '#10b981' : urgent ? '#ef4444' : '#1A73E8';
  const mins = Math.ceil(remainingSec / 60);

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
        <circle cx="24" cy="24" r={R} fill="none" strokeWidth="4" className="stroke-muted" />
        <motion.circle
          cx="24" cy="24" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * elapsedFrac }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {done ? (
          <Check className="w-5 h-5 text-emerald-500" />
        ) : (
          <span className={`text-[10px] font-bold leading-none ${urgent ? 'text-destructive' : 'text-foreground'}`}>
            {goal.status === 'in_progress' ? fmtClock(remainingSec) : `${mins}m`}
          </span>
        )}
      </div>
    </div>
  );
}

export default function StudentDailyGoalsPage() {
  const { user, profile } = useAuthSTORE();
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [courses, setCourses] = useState<{ course: Course; enrollment: Enrollment }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'today' | 'history' | 'insights'>('today');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [poppedId, setPoppedId] = useState<string | null>(null);
  const [modalDone, setModalDone] = useState(false);

  // Add-goal form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('study');
  const [estimateMinutes, setEstimateMinutes] = useState(30);
  const [deadline, setDeadline] = useState('');
  const [courseId, setCourseId] = useState('');
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const todayKey = goalDateKey();

  // Default deadline: two hours out, rounded up to the next quarter hour.
  useEffect(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    setDeadline(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }, []);

  // Live feed of every goal (history included) so streaks and insights work.
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let cancelled = false;
    const unsub = subscribeDailyGoals(user.uid, list => {
      if (cancelled) return;
      setGoals(list);
      setLoading(false);
    });
    return () => { cancelled = true; unsub(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getEnrolledCourses(user.uid)
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [user]);

  // Ticker for the countdown rings.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const todaysGoals = useMemo(() => goals.filter(g => g.dateKey === todayKey), [goals, todayKey]);

  // Fire parent alerts on mount and once a minute.
  const goalsRef = useRef<DailyGoal[]>([]);
  goalsRef.current = todaysGoals;
  useEffect(() => {
    if (!user) return;
    const run = () => {
      if (!goalsRef.current.length) return;
      checkGoalAlerts(user.uid, profile?.name ?? user.displayName ?? 'Student', goalsRef.current).catch(() => {});
    };
    run();
    const t = setInterval(run, 60_000);
    return () => clearInterval(t);
  }, [user, profile?.name]);

  const stats = useMemo(() => {
    const inProgress = todaysGoals.filter(g => g.status === 'in_progress').length;
    const completed = todaysGoals.filter(g => g.status === 'completed').length;
    return { total: todaysGoals.length, inProgress, completed, streak: computeGoalStreak(goals) };
  }, [todaysGoals, goals]);

  const anyStarted = todaysGoals.some(g => g.status !== 'not_started');
  const firstName = (profile?.name ?? user?.displayName ?? 'there').split(' ')[0];

  const aylaMessage = useMemo(() => {
    if (todaysGoals.length === 0) {
      return `${greeting()} ${firstName}. You haven't set any goals yet today — tell me what you're committing to and I'll keep you honest.`;
    }
    if (stats.completed === stats.total) {
      return `All goals complete, ${firstName}! Your streak is safe 🔥 That's ${stats.total} commitment${stats.total !== 1 ? 's' : ''} kept today.`;
    }
    const overdue = todaysGoals.filter(g => displayStatus(g, nowMs) === 'overdue').length;
    if (overdue > 0) {
      return `${firstName}, ${overdue} goal${overdue !== 1 ? 's have' : ' has'} slipped past its deadline. Finish it now — late still earns you XP, and your parent can excuse it if something came up.`;
    }
    if (!anyStarted) {
      return `${greeting()} ${firstName}. You've set ${stats.total} goal${stats.total !== 1 ? 's' : ''} today but haven't started any. Press "Start Goal" on the first one and your courses unlock.`;
    }
    return `${greeting()} ${firstName}. You've completed ${stats.completed} of ${stats.total} goals today${stats.inProgress ? ` and you're mid-way through ${stats.inProgress}` : ''}. Keep going — you're close.`;
  }, [todaysGoals, stats, firstName, anyStarted, nowMs]);

  // ── History ──────────────────────────────────────────────────────────────
  const history = useMemo(() => {
    const byDay = new Map<string, DailyGoal[]>();
    goals.filter(g => g.dateKey !== todayKey).forEach(g => {
      if (!byDay.has(g.dateKey)) byDay.set(g.dateKey, []);
      byDay.get(g.dateKey)!.push(g);
    });
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, list]) => {
        const done = list.filter(g => g.status === 'completed' || g.status === 'excused').length;
        return { dateKey, goals: list, done, rate: list.length ? Math.round((done / list.length) * 100) : 0 };
      });
  }, [goals, todayKey]);

  // Last 14 days: hit / miss / today / no goals.
  const streakStrip = useMemo(() => {
    const byDay = new Map<string, DailyGoal[]>();
    goals.forEach(g => {
      if (!byDay.has(g.dateKey)) byDay.set(g.dateKey, []);
      byDay.get(g.dateKey)!.push(g);
    });
    const out: { key: string; label: string; state: 'hit' | 'miss' | 'today' | 'none' }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = goalDateKey(d);
      const day = byDay.get(key) ?? [];
      const hit = day.length > 0 && day.every(g => g.status === 'completed' || g.status === 'excused');
      out.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        state: i === 0 && !hit ? 'today' : hit ? 'hit' : day.length ? 'miss' : 'none',
      });
    }
    return out;
  }, [goals]);

  // ── Insights (all computed locally) ──────────────────────────────────────
  const insights = useMemo(() => {
    const byDay = new Map<string, DailyGoal[]>();
    goals.forEach(g => {
      if (!byDay.has(g.dateKey)) byDay.set(g.dateKey, []);
      byDay.get(g.dateKey)!.push(g);
    });
    const dayRates = [...byDay.values()].map(list =>
      list.filter(g => g.status === 'completed' || g.status === 'excused').length / list.length
    );
    const avgCompletion = dayRates.length
      ? Math.round((dayRates.reduce((a, b) => a + b, 0) / dayRates.length) * 100)
      : null;

    let bestCategory: { label: string; rate: number } | null = null;
    CATEGORY_ORDER.forEach(cat => {
      const list = goals.filter(g => g.category === cat);
      if (list.length < 1) return;
      const rate = Math.round((list.filter(g => g.status === 'completed').length / list.length) * 100);
      if (!bestCategory || rate > bestCategory.rate) bestCategory = { label: CATEGORY_META[cat].label, rate };
    });

    const estimated = goals.filter(g => g.status === 'completed' && g.actualMinutes && g.estimateMinutes);
    const accuracy = estimated.length
      ? Math.round(
          (estimated.reduce((a, g) => a + (g.actualMinutes! / g.estimateMinutes), 0) / estimated.length) * 100
        )
      : null;

    const buckets: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0 };
    goals.forEach(g => {
      const t = g.completedAt?.toDate?.();
      if (!t) return;
      const h = t.getHours();
      buckets[h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening']++;
    });
    const bestSlot = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    const productiveTime = bestSlot && bestSlot[1] > 0 ? bestSlot[0] : null;

    const totalCompleted = goals.filter(g => g.status === 'completed').length;
    const totalXp = goals.reduce((a, g) => a + (g.xpAwarded ?? 0), 0);

    return { avgCompletion, bestCategory: bestCategory as { label: string; rate: number } | null, accuracy, productiveTime, totalCompleted, totalXp, daysTracked: byDay.size };
  }, [goals]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => titleRef.current?.focus(), 350);
  };

  const handleAdd = async () => {
    if (!user || !title.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const linked = courses.find(c => c.course.id === courseId);
      await createDailyGoal({
        studentId: user.uid,
        studentName: profile?.name ?? user.displayName ?? 'Student',
        dateKey: todayKey,
        title: title.trim(),
        category,
        estimateMinutes,
        deadline: deadline || '23:59',
        status: 'not_started',
        ...(linked ? { courseId: linked.course.id, courseLabel: linked.course.title } : {}),
      });
      setTitle('');
      setCourseId('');
      toast.success('Goal added.');
    } catch {
      toast.error('Could not add that goal. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleStart = async (goal: DailyGoal) => {
    setBusyId(goal.id);
    try {
      await startDailyGoal(goal.id);
      toast.success('Goal started — your courses are unlocked.');
    } catch {
      toast.error('Could not start that goal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (goal: DailyGoal) => {
    setBusyId(goal.id);
    try {
      const onTime = Date.now() <= deadlineDate(goal).getTime();
      const { xp } = await completeDailyGoal(goal, onTime);
      setPoppedId(goal.id);
      setTimeout(() => setPoppedId(null), 800);
      toast.success(`+${xp} XP`, { description: onTime ? 'Completed on time. Nice work!' : 'Completed late — still counts.' });
    } catch {
      toast.error('Could not complete that goal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDailyGoal(id);
      toast.success('Goal removed.');
    } catch {
      toast.error('Could not remove that goal.');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-3 pt-8">
        <div className="h-4 w-28 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-56 bg-muted animate-pulse rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-3xl" />)}
      </div>
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={() => setError(null)} className="rounded-full h-11 px-6 font-bold">Dismiss</Button>
      </div>
    </div>
  );

  const renderGoalCard = (goal: DailyGoal, i: number) => {
    const st = displayStatus(goal, nowMs);
    const cat = CATEGORY_META[goal.category] ?? CATEGORY_META.other;
    const minsToDeadline = Math.round((deadlineDate(goal).getTime() - nowMs) / 60000);
    const deadlineTone =
      st === 'completed' || st === 'excused' ? 'text-muted-foreground'
      : minsToDeadline < 0 ? 'text-destructive font-bold'
      : minsToDeadline < 30 ? 'text-amber-600 font-semibold'
      : 'text-muted-foreground';

    return (
      <motion.div
        key={goal.id}
        variants={fadeUp}
        initial="hidden"
        animate={poppedId === goal.id ? { opacity: 1, y: 0, scale: [1, 1.04, 1] } : 'visible'}
        custom={i}
        transition={poppedId === goal.id ? { duration: 0.55, ease: 'easeOut' } : undefined}
        className={`bg-card border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 card-glow ${
          st === 'overdue' ? 'border-destructive/40' : 'border-border'
        }`}
      >
        <CountdownRing goal={goal} nowMs={nowMs} />

        <div className="flex-1 min-w-0">
          <p className={`font-bold text-foreground truncate ${st === 'completed' ? 'line-through opacity-70' : ''}`}>
            {goal.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${cat.pill}`}>
              {cat.label}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_META[st].pill}`}>
              {STATUS_META[st].label}
            </span>
            {goal.courseLabel && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground truncate max-w-[12rem]">
                {goal.courseLabel}
              </span>
            )}
            <span className={`text-xs flex items-center gap-1 ${deadlineTone}`}>
              <Clock className="w-3 h-3" />
              {fmtDeadline(goal.deadline)}
              {st !== 'completed' && st !== 'excused' && minsToDeadline >= 0 && minsToDeadline < 120 && ` · ${minsToDeadline}m left`}
            </span>
            <span className="text-xs text-muted-foreground">· {goal.estimateMinutes} min</span>
          </div>
          {goal.status === 'excused' && goal.excuseReason && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Excused by {goal.excusedBy || 'parent'}: {goal.excuseReason}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {goal.status === 'not_started' && (
            <Button
              onClick={() => handleStart(goal)}
              disabled={busyId === goal.id}
              className="rounded-full h-10 px-4 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white hover:opacity-90 transition-opacity gap-2"
            >
              {busyId === goal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Goal
            </Button>
          )}
          {goal.status === 'in_progress' && (
            <Button
              onClick={() => handleComplete(goal)}
              disabled={busyId === goal.id}
              className="rounded-full h-10 px-4 font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors gap-2"
            >
              {busyId === goal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Mark Complete
            </Button>
          )}
          {goal.status === 'completed' && (
            <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 px-2">
              <CheckCircle2 className="w-4 h-4" /> Completed
              {goal.xpAwarded ? <span className="text-xs text-muted-foreground">+{goal.xpAwarded} XP</span> : null}
            </span>
          )}
          {goal.status === 'excused' && (
            <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5 px-2">
              <ShieldCheck className="w-4 h-4" /> Excused
            </span>
          )}
          <button
            onClick={() => handleDelete(goal.id)}
            aria-label="Delete goal"
            className="text-muted-foreground hover:text-destructive transition-colors p-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Blocking goal-setting gate for a fresh day */}
      {user && (
        <DailyGoalsModal
          open={!loading && todaysGoals.length === 0 && !modalDone}
          studentId={user.uid}
          studentName={profile?.name ?? user.displayName ?? 'Student'}
          onDone={() => setModalDone(true)}
        />
      )}

      {/* ── Page header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">PRODUCTIVITY</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          My Daily <span className="gradient-text italic">Goals</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-lg">
          Set what you&apos;re committing to before you start your modules. Ayla checks in, your streak keeps score,
          and your parent sees how the day went.
        </p>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Goals Today', value: stats.total, accent: 'bg-primary', icon: Target },
          { label: 'In Progress', value: stats.inProgress, accent: 'bg-[#1A73E8]', icon: Play },
          { label: 'Completed', value: stats.completed, accent: 'bg-emerald-500', icon: CheckCircle2 },
          { label: '🔥 Streak', value: `${stats.streak}d`, accent: 'bg-amber-500', icon: Flame },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden card-glow">
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${stat.accent} opacity-80`} />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
            <p className="font-heading text-3xl text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Ayla prompt strip ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={2}
        className="relative bg-[#070B14] rounded-3xl p-5 sm:p-6 text-white overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#1A73E8]/25 blur-[80px]" />
          <div className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-[#7C3AED]/20 blur-[80px]" />
        </div>
        <div className="relative flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(26,115,232,0.4)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Ayla · AI Tutor</p>
            <p className="text-[15px] leading-relaxed mt-1.5 text-white/90">{aylaMessage}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Gate banner ── */}
      {!anyStarted && (
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-heading text-xl text-foreground">Start a goal to unlock your courses</p>
              <p className="text-sm text-muted-foreground mt-1">
                Modules stay locked until today&apos;s first goal is underway.
              </p>
            </div>
          </div>
          <Button onClick={focusForm} className="rounded-full h-11 px-5 font-bold gap-2 shrink-0 bg-amber-500 text-white hover:bg-amber-600 transition-colors">
            <Plus className="w-4 h-4" /> Add Goal
          </Button>
        </motion.div>
      )}

      {/* ── Add-goal form ── */}
      <motion.div
        ref={formRef}
        variants={fadeUp} initial="hidden" animate="visible" custom={4}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow space-y-4"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-2xl text-foreground">New goal</h2>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Goal</span>
          <Input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Revise photosynthesis for the unit quiz"
            className="rounded-full h-11"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as GoalCategory)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Time estimate</span>
            <select
              value={estimateMinutes}
              onChange={e => setEstimateMinutes(Number(e.target.value))}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              {ESTIMATE_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Deadline</span>
            <input
              type="time"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Link to course</span>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">No course</option>
              {courses.map(({ course }) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
        </div>

        <Button
          onClick={handleAdd}
          disabled={adding || !title.trim()}
          className="rounded-full h-11 px-6 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white hover:opacity-90 transition-opacity gap-2 w-full sm:w-auto"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Goal
        </Button>
      </motion.div>

      {/* ── Streak strip ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <h2 className="font-heading text-xl text-foreground">Last 14 days</h2>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">{stats.streak} day streak</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {streakStrip.map(d => (
            <div
              key={d.key}
              title={`${d.label} · ${d.state === 'hit' ? 'all goals done' : d.state === 'miss' ? 'goals missed' : d.state === 'today' ? 'today' : 'no goals set'}`}
              className={`w-7 h-7 rounded-lg ${
                d.state === 'hit' ? 'bg-emerald-500'
                : d.state === 'miss' ? 'bg-destructive/30'
                : d.state === 'today' ? 'bg-primary/25 ring-2 ring-primary'
                : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6} className="space-y-6">
        <div className="inline-flex gap-1 p-1 rounded-full bg-muted/50 border border-border">
          {([
            { id: 'today', label: 'Today', icon: Target },
            { id: 'history', label: 'History', icon: CalendarDays },
            { id: 'insights', label: 'Insights', icon: LineChart },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full h-9 px-4 text-sm font-semibold flex items-center gap-2 transition-colors ${
                tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'today' && (
            <motion.div key="today" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {todaysGoals.length === 0 ? (
                <div className="relative text-center py-20">
                  <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-primary/8 blur-[80px]" />
                  <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h3 className="font-heading text-2xl text-foreground">No goals set for today</h3>
                  <p className="text-sm text-muted-foreground mt-2">Add your first goal above to unlock your courses.</p>
                </div>
              ) : (
                todaysGoals.map(renderGoalCard)
              )}
            </motion.div>
          )}

          {tab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {history.length === 0 ? (
                <div className="text-center py-20">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h3 className="font-heading text-2xl text-foreground">No history yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">Once you finish a day of goals it&apos;ll show up here.</p>
                </div>
              ) : (
                history.map((day, di) => (
                  <motion.div key={day.dateKey} variants={fadeUp} initial="hidden" animate="visible" custom={di} className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-heading text-xl text-foreground">
                          {new Date(`${day.dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{day.done} of {day.goals.length} completed</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-heading text-3xl ${day.rate === 100 ? 'text-emerald-600' : day.rate >= 50 ? 'text-amber-600' : 'text-destructive'}`}>{day.rate}%</p>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${day.rate === 100 ? 'bg-emerald-500' : day.rate >= 50 ? 'bg-amber-500' : 'bg-destructive'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${day.rate}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="space-y-2">
                      {day.goals.map(g => {
                        const st = displayStatus(g, nowMs);
                        const cat = CATEGORY_META[g.category] ?? CATEGORY_META.other;
                        return (
                          <div key={g.id} className="flex items-center gap-3 text-sm">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dot}`} />
                            <span className={`flex-1 truncate ${st === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{g.title}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${STATUS_META[st].pill}`}>
                              {STATUS_META[st].label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {tab === 'insights' && (
            <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {goals.length === 0 ? (
                <div className="text-center py-20">
                  <LineChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h3 className="font-heading text-2xl text-foreground">Not enough data yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">Set and complete a few goals and Ayla will spot your patterns.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Avg completion', value: insights.avgCompletion !== null ? `${insights.avgCompletion}%` : '—' },
                      { label: 'Days tracked', value: insights.daysTracked },
                      { label: 'Goals completed', value: insights.totalCompleted },
                      { label: 'XP from goals', value: insights.totalXp },
                    ].map(s => (
                      <div key={s.label} className="bg-card border border-border rounded-3xl p-5 card-glow">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
                        <p className="font-heading text-3xl text-foreground mt-1">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {[
                      insights.avgCompletion !== null &&
                        `You complete ${insights.avgCompletion}% of the goals you set, across ${insights.daysTracked} day${insights.daysTracked !== 1 ? 's' : ''}. ${insights.avgCompletion >= 80 ? 'That is genuinely strong follow-through.' : 'Try setting one fewer goal a day — smaller commitments get kept.'}`,
                      insights.bestCategory &&
                        `Your strongest category is ${insights.bestCategory.label} at ${insights.bestCategory.rate}% completion. Lean on that momentum when a harder subject is on the list.`,
                      insights.accuracy !== null &&
                        (insights.accuracy > 115
                          ? `Your goals take about ${insights.accuracy}% of the time you estimate — you're under-budgeting. Add roughly ${Math.round(insights.accuracy - 100)}% to your next estimate.`
                          : insights.accuracy < 85
                            ? `You finish in about ${insights.accuracy}% of your estimated time — you're over-budgeting. You could commit to a little more each day.`
                            : `Your time estimates land within ${Math.abs(100 - insights.accuracy)}% of reality. That's excellent planning.`),
                      insights.productiveTime &&
                        `Most of your goals get finished in the ${insights.productiveTime.toLowerCase()}. Schedule the hardest one for then.`,
                    ].filter(Boolean).map((line, i) => (
                      <motion.div
                        key={i}
                        variants={fadeUp} initial="hidden" animate="visible" custom={i}
                        className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 card-glow"
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{line as string}</p>
                      </motion.div>
                    ))}
                    {insights.avgCompletion === null && (
                      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <p className="text-sm text-muted-foreground">Complete a few more goals for richer insights.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
