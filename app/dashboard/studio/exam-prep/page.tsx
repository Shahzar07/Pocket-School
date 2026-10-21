'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Plus, Flame, CalendarDays, Target, GraduationCap, Link2, FileText, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { StudioCanvas } from '@/components/studio/studio-canvas';
import { listPreps } from '@/lib/study/db';
import { daysBetween, dueToday, isoDay } from '@/lib/study/schedule';
import { gradeFor, weightedMastery } from '@/lib/study/grades';
import type { ExamPrep } from '@/lib/study/types';

export default function ExamPrepListPage() {
  const { user } = useAuthSTORE();
  const [preps, setPreps] = useState<ExamPrep[] | null>(null);
  const [joinLink, setJoinLink] = useState('');

  useEffect(() => {
    if (!user) return;
    listPreps(user.uid).then(setPreps).catch(() => setPreps([]));
  }, [user]);

  const today = isoDay();
  const upcoming = (preps ?? []).filter(p => p.examDate >= today);
  const past = (preps ?? []).filter(p => p.examDate < today);

  const join = () => {
    const m = /join\/([A-Za-z0-9]+)/.exec(joinLink) ?? /^([A-Za-z0-9]{12,})$/.exec(joinLink.trim());
    if (m) location.href = `/dashboard/studio/exam-prep/join/${m[1]}`;
  };

  return (
    <StudioCanvas
      canvas="exams"
      title="ET Exams"
      description="Add your notes, slides and past papers. ET AI turns them into a day-by-day plan that ends on your exam date: lessons, quizzes, flashcards, podcasts and a full mock."
      actions={
        <Link href="/dashboard/studio/exam-prep/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] hover:opacity-90">
          <Plus className="h-4 w-4" /> New exam prep
        </Link>
      }
    >
      <div className="flex min-h-full flex-col gap-6">
        {preps === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-52 animate-pulse rounded-2xl bg-[var(--studio-raised)]" />)}</div>
        ) : preps.length === 0 ? (
          <div className="grid items-start gap-8 md:grid-cols-2">
            <div>
              <p className="mb-2 font-heading text-2xl text-[var(--studio-text)]">Your notes in. Your study plan out.</p>
              <p className="mb-5 text-sm leading-relaxed text-[var(--studio-dim)]">Upload photos of your notes, PDFs, slides or old exams and set your exam date. ET AI finds the topics, builds your plan and teaches you from your own material — so you only study what&apos;s actually on the exam.</p>
              <Link href="/dashboard/studio/exam-prep/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#3FE0D0] px-5 font-semibold text-[#203337]"><Sparkles className="h-4 w-4" /> Create my first plan</Link>
            </div>
            <ol className="space-y-3">
              {[
                { icon: FileText, t: 'Add your material', d: 'PDFs, photos of notes, past papers.' },
                { icon: CalendarDays, t: 'Set your exam date and target', d: 'The plan ends exactly on time.' },
                { icon: Target, t: 'Follow today’s goals', d: 'Lessons, quizzes, flashcards, podcasts.' },
                { icon: GraduationCap, t: 'Sit a full mock', d: 'Marked, graded, with your gaps.' },
              ].map(({ icon: I, t, d }, i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#3FE0D0]/15 text-[#1E6A83]"><I className="h-4 w-4" /></span>
                  <span><span className="text-[13px] text-[var(--studio-dim)]">Step {i + 1}</span><span className="block font-semibold text-[var(--studio-text)]">{t}</span><span className="text-[13px] text-[var(--studio-dim)]">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((p, i) => <PrepCard key={p.id} prep={p} index={i} />)}
            </div>
            {past.length > 0 && (
              <>
                <p className="pt-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--studio-dim)]">Past exams</p>
                <div className="grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">
                  {past.map((p, i) => <PrepCard key={p.id} prep={p} index={i} />)}
                </div>
              </>
            )}
          </>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[var(--studio-border-soft)] pt-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--studio-raised)]"><Link2 className="h-4 w-4" /></span>
          <div className="min-w-[200px] flex-1">
            <p className="text-[15px] font-semibold text-[var(--studio-text)]">Got a link from a classmate?</p>
            <p className="text-[13px] text-[var(--studio-dim)]">Start your own copy of their plan — your progress stays private.</p>
          </div>
          <input value={joinLink} onChange={e => setJoinLink(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} placeholder="Paste the share link" aria-label="Share link"
            className="h-10 w-full rounded-full border border-[var(--studio-border)] bg-transparent px-4 text-sm text-[var(--studio-text)] outline-none focus:border-[#3FE0D0] sm:w-72" />
          <button type="button" onClick={join} className="h-10 rounded-full border border-[var(--studio-border)] px-4 text-sm font-semibold">Open</button>
        </div>
      </div>
    </StudioCanvas>
  );
}

function PrepCard({ prep, index }: { prep: ExamPrep; index: number }) {
  const today = isoDay();
  const left = daysBetween(today, prep.examDate);
  const mastery = weightedMastery(prep.topics, prep.mastery ?? {});
  const { items } = dueToday(prep.plan, prep.completed ?? {}, today);
  const grade = Object.keys(prep.mastery ?? {}).length ? gradeFor(prep.gradeScale, mastery) : '—';
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link href={`/dashboard/studio/exam-prep/${prep.id}`} className="group block rounded-2xl border border-[var(--studio-border-soft)] bg-[var(--studio-surface)] p-5 transition-colors hover:border-[#3FE0D0]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary truncate">{prep.subject || 'Exam'}</p>
            <p className="font-heading text-[20px] leading-tight text-foreground mt-1 line-clamp-2">{prep.title}</p>
          </div>
          <span className={`shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full ${left < 0 ? 'bg-muted text-muted-foreground' : left <= 3 ? 'bg-rose-50 text-rose-700' : 'bg-primary/10 text-primary'}`}>
            {left < 0 ? 'Done' : left === 0 ? 'Today' : `${left}d`}
          </span>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-muted-foreground">Mastery</span>
            <span className="font-semibold tabular-nums">{mastery}% <span className="text-muted-foreground font-normal">/ target {prep.targetScore}%</span></span>
          </div>
          <div className="relative h-2 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${mastery}%` }} />
            <span className="absolute -top-1 w-0.5 h-4 bg-rose-400 rounded" style={{ left: `${prep.targetScore}%` }} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-[13px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Flame className="w-4 h-4 text-[var(--ps-cyan-text)]" /> <span className="tabular-nums text-foreground font-semibold">{prep.streak ?? 0}</span></span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><GraduationCap className="w-4 h-4" /> est. <span className="text-foreground font-semibold">{grade}</span></span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">{items.length ? `${items.length} due` : 'All done'} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
        </div>
      </Link>
    </motion.div>
  );
}
