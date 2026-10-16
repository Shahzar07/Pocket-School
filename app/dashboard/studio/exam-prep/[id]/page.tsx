'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, Flame, CalendarDays, CheckCircle2, BookOpen, ListChecks, Layers, PenLine, Headphones,
  GraduationCap, Mic, Share2, Settings2, Trash2, ChevronRight, Target, Sparkles, AlertTriangle, Copy, Loader2, Trophy, MessageCircle,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useExamPrep } from '@/hooks/use-exam-prep';
import { DashPage, Panel, PanelHeader, Segmented } from '@/components/dash-ui';
import { WeekStrip } from '@/components/study/week-strip';
import { MasteryBar } from '@/components/study/mastery-bar';
import { buildSchedule, daysBetween, dueToday, isoDay, parseDay, addDays } from '@/lib/study/schedule';
import { gradeFor, weightedMastery, GRADE_SCALES } from '@/lib/study/grades';
import { deletePrep, listAttempts, sharePrep } from '@/lib/study/db';
import type { ExamAttempt } from '@/lib/study/types';
import { itemHref } from '@/lib/study/links';

type Tab = 'today' | 'topics' | 'progress' | 'exams';

const ASSET_ICON: Record<string, typeof BookOpen> = {
  lesson: BookOpen, quiz: ListChecks, flashcards: Layers, exercises: PenLine, truefalse: CheckCircle2, podcast: Headphones, mock: GraduationCap,
};

export default function ExamPrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useAuthSTORE();
  const { prep, loading, missing, uid, patch } = useExamPrep(id);
  const [tab, setTab] = useState<Tab>('today');
  const [day, setDay] = useState(isoDay());
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [settings, setSettings] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (uid && prep) listAttempts(uid, prep.id).then(setAttempts).catch(() => {});
  }, [uid, prep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = isoDay();
  const stats = useMemo(() => {
    if (!prep) return null;
    const mastery = weightedMastery(prep.topics, prep.mastery ?? {});
    const all = prep.plan.flatMap(d => d.items);
    const done = all.filter(i => prep.completed?.[i.id]).length;
    const { items: due, overdue } = dueToday(prep.plan, prep.completed ?? {}, today);
    const todays = prep.plan.find(d => d.date === today)?.items ?? [];
    const todayDone = todays.filter(i => prep.completed?.[i.id]).length;
    // No evidence yet means no estimate — "G" on day one helps nobody.
    const hasEvidence = Object.keys(prep.mastery ?? {}).length > 0;
    return { mastery, done, total: all.length, due, overdue, todays, todayDone, grade: hasEvidence ? gradeFor(prep.gradeScale, mastery) : '—', left: daysBetween(today, prep.examDate) };
  }, [prep, today]);

  if (loading) return <DashPage><div className="h-64 rounded-2xl bg-muted animate-pulse" /></DashPage>;
  if (missing || !prep || !stats) {
    return (
      <DashPage>
        <Panel><p className="text-foreground font-semibold">This exam prep wasn&apos;t found.</p>
          <Link href="/dashboard/studio/exam-prep" className="text-primary text-sm font-semibold">Back to Exam Prep</Link></Panel>
      </DashPage>
    );
  }

  const selectedItems = prep.plan.find(d => d.date === day)?.items ?? [];
  const showItems = day === today ? stats.due : selectedItems;

  const reschedule = async (date: string) => {
    if (date <= today) return toast.error('Pick a date after today.');
    await patch({ examDate: date, plan: buildSchedule(prep.topics, date, { minutesPerDay: prep.minutesPerDay }) });
    toast.success('Plan rescheduled — your progress is kept.');
  };

  const share = async () => {
    if (!uid) return;
    setSharing(true);
    try {
      const sid = await sharePrep(uid, profile?.name ?? 'A classmate', prep);
      if (!prep.shareId) await patch({ shareId: sid });
      const link = `${location.origin}/dashboard/studio/exam-prep/join/${sid}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success('Share link copied — classmates get the plan, never your results.');
    } catch {
      toast.error('Could not create a share link.');
    } finally { setSharing(false); }
  };

  const remove = async () => {
    if (!uid || !confirm(`Delete "${prep.title}" and all its progress?`)) return;
    await deletePrep(uid, prep.id);
    toast.success('Exam prep deleted.');
    router.push('/dashboard/studio/exam-prep');
  };

  const examDay = parseDay(prep.examDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <DashPage>
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/studio/exam-prep" className="text-[13px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> All exam preps</Link>
        <div className="flex items-center gap-2">
          <button onClick={share} disabled={sharing} className="h-9 px-3.5 rounded-full border border-border text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-muted">
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share with classmates
          </button>
          <button onClick={() => setSettings(s => !s)} className="h-9 w-9 rounded-full border border-border grid place-items-center hover:bg-muted" aria-label="Settings"><Settings2 className="w-4 h-4" /></button>
        </div>
      </div>

      {settings && (
        <Panel>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="block text-[13px] font-semibold mb-1.5">Move the exam date</span>
              <input type="date" defaultValue={prep.examDate} min={addDays(today, 1)} onChange={e => e.target.value && reschedule(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            </label>
            <p className="text-[12px] text-muted-foreground flex-1 min-w-[200px]">Rescheduling rebuilds the calendar; everything you&apos;ve completed stays completed.</p>
            <button onClick={remove} className="h-10 px-4 rounded-full border border-rose-200 text-rose-700 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-rose-50"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        </Panel>
      )}

      {/* Hero */}
      <Panel className="overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{prep.subject || 'Exam prep'}</p>
            <h1 className="font-heading text-[30px] sm:text-[36px] leading-[1.08] tracking-[-0.04em] text-foreground mt-1">{prep.title}</h1>
            <p className="text-[14px] text-muted-foreground mt-1.5">
              {stats.left > 0 ? <>Exam in <span className="font-semibold text-foreground">{stats.left} day{stats.left === 1 ? '' : 's'}</span> · {examDay}</> : stats.left === 0 ? <span className="font-semibold text-rose-600">Exam day — you&apos;ve got this.</span> : 'Exam finished'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill icon={Flame} tone="orange" value={prep.streak ?? 0} label="streak" />
            <Pill icon={Target} tone="rose" value={prep.targetGrade} label="target" />
            <Pill icon={GraduationCap} tone="primary" value={stats.grade} label="estimated" />
          </div>
        </div>
        <div className="relative mt-5"><WeekStrip plan={prep.plan} completed={prep.completed ?? {}} examDate={prep.examDate} selected={day} onSelect={setDay} /></div>
      </Panel>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented
          options={[{ id: 'today', label: 'Today' }, { id: 'topics', label: 'Topics' }, { id: 'progress', label: 'Progress' }, { id: 'exams', label: 'Mock & oral' }] as const}
          value={tab}
          onChange={setTab}
        />
        <Link href={`/dashboard/studio/exam-prep/${prep.id}/topic/all?tab=chat`} className="text-[13px] font-semibold text-primary inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Ask ET AI about your notes</Link>
      </div>

      {tab === 'today' && (
        <div className="grid lg:grid-cols-12 gap-5">
          <Panel className="lg:col-span-8">
            <PanelHeader
              title={day === today ? 'Today’s goals' : parseDay(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              meta={day === today && stats.todays.length ? <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">{stats.todayDone}/{stats.todays.length} done</span> : undefined}
            />
            {day === today && stats.overdue > 0 && (
              <p className="mb-3 text-[13px] rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {stats.overdue} item{stats.overdue === 1 ? '' : 's'} carried over from earlier days.</p>
            )}
            {showItems.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-4xl mb-2">{day === today ? '🎉' : '🌤️'}</p>
                <p className="font-semibold text-foreground">{day === today ? 'All done for today.' : 'Nothing planned this day.'}</p>
                <p className="text-[13px] text-muted-foreground mt-1">{day === today ? 'Want to get ahead? Pick any topic, or take a mock exam.' : 'Rest days are part of the plan.'}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {showItems.map((it, i) => {
                  const Icon = ASSET_ICON[it.asset] ?? BookOpen;
                  const done = !!prep.completed?.[it.id];
                  return (
                    <motion.li key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <Link href={itemHref(prep.id, it)} className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${done ? 'border-emerald-200 bg-emerald-50/50' : 'border-border hover:border-primary/40 hover:bg-primary/[0.03]'}`}>
                        <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${done ? 'bg-emerald-100 text-emerald-700' : it.kind === 'mock' ? 'bg-rose-50 text-rose-600' : 'bg-primary/10 text-primary'}`}><Icon className="w-5 h-5" /></span>
                        <span className="flex-1 min-w-0">
                          <span className={`block font-semibold text-[15px] truncate ${done ? 'text-emerald-900' : 'text-foreground'}`}>{it.title}</span>
                          <span className="text-[12px] text-muted-foreground capitalize">{it.kind} · {it.minutes} min</span>
                        </span>
                        {done ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />}
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <div className="lg:col-span-4 space-y-5">
            <Panel>
              <PanelHeader title="Mastery" meta={<span className="text-[13px] font-semibold text-primary tabular-nums">{stats.mastery}%</span>} />
              <MasteryBar value={stats.mastery} target={prep.targetScore} initial={profile?.name ?? 'Me'} label={stats.mastery >= prep.targetScore ? 'On target — keep it there.' : `${prep.targetScore - stats.mastery}% to your ${prep.targetGrade}. Keep it up 💪`} />
            </Panel>
            <Panel>
              <PanelHeader title="Plan" />
              <dl className="space-y-2.5 text-[14px]">
                <Row icon={CalendarDays} k="Exam date" v={examDay} />
                <Row icon={Target} k="Target" v={`${prep.targetGrade} · ${prep.targetScore}%`} />
                <Row icon={Flame} k="Streak" v={`${prep.streak ?? 0} day${prep.streak === 1 ? '' : 's'}`} />
                <Row icon={CheckCircle2} k="Completed" v={`${stats.done} / ${stats.total}`} />
              </dl>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'topics' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...prep.topics].sort((a, b) => a.order - b.order).map((t, i) => {
            const m = prep.mastery?.[t.id] ?? 0;
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/dashboard/studio/exam-prep/${prep.id}/topic/${t.id}`} className="block h-full bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] p-5 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums">TOPIC {i + 1}</span>
                    <span className="text-amber-400 text-[12px] tracking-tight" aria-label={`Weight ${t.weight}`}>{'★'.repeat(t.weight)}<span className="text-muted-foreground/30">{'★'.repeat(5 - t.weight)}</span></span>
                  </div>
                  <p className="font-semibold text-[16px] text-foreground mt-1 leading-snug">{t.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{t.summary}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${m >= prep.targetScore ? 'bg-emerald-500' : m >= 40 ? 'bg-primary' : 'bg-amber-400'}`} style={{ width: `${m}%` }} /></div>
                    <span className="text-[12px] font-semibold tabular-nums w-9 text-right">{m}%</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === 'progress' && (
        <div className="grid lg:grid-cols-12 gap-5">
          <Panel className="lg:col-span-4 text-center">
            <p className="text-[13px] font-semibold text-muted-foreground">Estimated {GRADE_SCALES[prep.gradeScale].label} grade</p>
            <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="font-heading text-[96px] leading-none mt-3 bg-gradient-to-b from-primary to-emerald-600 bg-clip-text text-transparent">{stats.grade}</motion.p>
            <p className="text-[13px] text-muted-foreground mt-3">{stats.grade === '—' ? 'Appears after your first quiz or mock.' : 'From your mastery across all topics, weighted by how much each one counts. Mocks move it most.'}</p>
          </Panel>
          <Panel className="lg:col-span-8">
            <PanelHeader title="Mastery by topic" />
            <ul className="space-y-3">
              {[...prep.topics].sort((a, b) => (prep.mastery?.[a.id] ?? 0) - (prep.mastery?.[b.id] ?? 0)).map(t => {
                const m = prep.mastery?.[t.id] ?? 0;
                return (
                  <li key={t.id} className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
                    <span className="text-[14px] text-foreground truncate">{t.title}</span>
                    <span className="text-[12px] font-semibold tabular-nums">{m}%</span>
                    <div className="col-span-2 relative h-2 rounded-full bg-muted mt-1">
                      <motion.div className={`absolute inset-y-0 left-0 rounded-full ${m >= prep.targetScore ? 'bg-emerald-500' : 'bg-primary'}`} initial={{ width: 0 }} animate={{ width: `${m}%` }} />
                      <span className="absolute -top-0.5 w-0.5 h-3 bg-rose-400" style={{ left: `${prep.targetScore}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel className="lg:col-span-12">
            <PanelHeader title="Study days" meta={<span className="text-[13px] text-muted-foreground">{prep.studyDays?.length ?? 0} days studied</span>} />
            <StudyCalendar days={prep.studyDays ?? []} examDate={prep.examDate} />
          </Panel>
        </div>
      )}

      {tab === 'exams' && (
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            <Link href={`/dashboard/studio/exam-prep/${prep.id}/mock`} className="group rounded-2xl p-5 bg-gradient-to-br from-[#0f2f3a] to-[#1b5566] text-white shadow-lg">
              <GraduationCap className="w-8 h-8 mb-6 opacity-90" />
              <p className="font-heading text-xl">Timed mock exam</p>
              <p className="text-[13px] text-white/70 mt-1">A full paper in the style of the real thing, marked against a mark scheme, with your gaps.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold">Start <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
            </Link>
            <Link href={`/dashboard/studio/exam-prep/${prep.id}/oral`} className="group rounded-2xl p-5 bg-card border border-border shadow-[var(--shadow-card)] hover:border-primary/40">
              <Mic className="w-8 h-8 mb-6 text-primary" />
              <p className="font-heading text-xl text-foreground">Oral exam with ET AI</p>
              <p className="text-[13px] text-muted-foreground mt-1">Answer out loud. ET AI examines, probes and grades how well you explain.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">Start <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
            </Link>
          </div>
          <Panel className="lg:col-span-5">
            <PanelHeader title="Past attempts" />
            {attempts.length === 0 ? <p className="text-[13px] text-muted-foreground">Your mock and oral results will appear here.</p> : (
              <ul className="space-y-2">
                {attempts.map(a => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                    <span className={`w-9 h-9 rounded-xl grid place-items-center ${a.kind === 'oral' ? 'bg-primary/10 text-primary' : 'bg-rose-50 text-rose-600'}`}>{a.kind === 'oral' ? <Mic className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold capitalize">{a.kind} exam</span>
                      <span className="text-[12px] text-muted-foreground">{a.createdAt?.toDate?.().toLocaleDateString() ?? ''} · {a.score}/{a.max}</span>
                    </span>
                    <span className="font-heading text-xl tabular-nums">{a.grade ?? `${a.percent}%`}</span>
                  </li>
                ))}
              </ul>
            )}
            {attempts[0]?.gaps?.length ? (
              <div className="mt-5">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">Latest gaps</p>
                <ul className="space-y-2">
                  {attempts[0].gaps!.slice(0, 3).map((g, i) => (
                    <li key={i}>
                      <Link href={`/dashboard/studio/exam-prep/${prep.id}/topic/${g.topicId}`} className="block rounded-xl border border-border px-3 py-2 hover:border-primary/40">
                        <span className={`text-[11px] font-bold uppercase ${g.severity === 'weakest' ? 'text-rose-600' : g.severity === 'attention' ? 'text-amber-600' : 'text-muted-foreground'}`}>{g.severity === 'weakest' ? 'Weakest area' : g.severity === 'attention' ? 'Needs attention' : 'Minor gap'}</span>
                        <span className="block text-[14px] font-semibold text-foreground">{g.topic}</span>
                        <span className="block text-[12px] text-muted-foreground">{g.fix}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Built from {prep.sourceNames.length} source{prep.sourceNames.length === 1 ? '' : 's'}: {prep.sourceNames.slice(0, 4).join(', ')}{prep.sourceNames.length > 4 ? '…' : ''}{prep.shareId && <> · <Copy className="w-3 h-3 inline" /> shared</>}</p>
    </DashPage>
  );
}

function Pill({ icon: I, value, label, tone }: { icon: typeof Flame; value: string | number; label: string; tone: 'orange' | 'rose' | 'primary' }) {
  const cls = tone === 'orange' ? 'text-orange-500' : tone === 'rose' ? 'text-rose-500' : 'text-primary';
  return (
    <div className="rounded-2xl border border-border bg-card px-3.5 py-2 text-center min-w-[78px]">
      <p className="font-heading text-[22px] leading-none text-foreground inline-flex items-center gap-1"><I className={`w-4 h-4 ${cls}`} />{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function Row({ icon: I, k, v }: { icon: typeof Flame; k: string; v: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <I className="w-4 h-4 text-muted-foreground" />
      <dt className="text-muted-foreground flex-1">{k}</dt>
      <dd className="font-semibold text-foreground tabular-nums">{v}</dd>
    </div>
  );
}

/** Last 10 weeks as a contribution-style grid, with the exam day marked. */
function StudyCalendar({ days, examDate }: { days: string[]; examDate: string }) {
  const set = new Set(days);
  const today = isoDay();
  const end = parseDay(today);
  const start = addDays(today, -69 - end.getDay());
  const cells = Array.from({ length: 70 + end.getDay() + 1 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-rows-7 grid-flow-col gap-1 w-max">
        {cells.map(d => (
          <span key={d} title={d}
            className={`w-3.5 h-3.5 rounded-[4px] ${d === examDate ? 'bg-rose-400' : set.has(d) ? 'bg-primary' : d > today ? 'bg-transparent' : 'bg-muted'}`} />
        ))}
      </div>
    </div>
  );
}
