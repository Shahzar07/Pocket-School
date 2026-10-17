'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Plus, Flame, CalendarDays, Target, GraduationCap, Link2, FileText, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashPage, DashHeader, Panel } from '@/components/dash-ui';
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
    <DashPage>
      <DashHeader
        eyebrow={<><Link href="/dashboard/studio" className="hover:underline">ET AI Studio</Link> · ET Exams</>}
        title="Walk into every exam"
        accent="ready."
        description="Add your notes, slides and past papers. ET AI turns them into a day-by-day plan that ends on your exam date: lessons, quizzes, flashcards, podcasts and a full mock."
        actions={
          <Link href="/dashboard/studio/exam-prep/new" className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> New exam prep
          </Link>
        }
      />

      {preps === null ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : preps.length === 0 ? (
        <Panel>
          <div className="grid md:grid-cols-2 gap-8 items-center py-4">
            <div>
              <p className="font-heading text-2xl text-foreground mb-2">Your notes in. Your study plan out.</p>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">Upload photos of your notes, PDFs, slides or old exams and set your exam date. ET AI finds the topics, builds your plan and teaches you from your own material — so you only study what&apos;s actually on the exam.</p>
              <Link href="/dashboard/studio/exam-prep/new" className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> Create my first plan</Link>
            </div>
            <ol className="space-y-3">
              {[
                { icon: FileText, t: 'Add your material', d: 'PDFs, photos of notes, past papers.' },
                { icon: CalendarDays, t: 'Set your exam date and target', d: 'The plan ends exactly on time.' },
                { icon: Target, t: 'Follow today’s goals', d: 'Lessons, quizzes, flashcards, podcasts.' },
                { icon: GraduationCap, t: 'Sit a full mock', d: 'Marked, graded, with your gaps.' },
              ].map(({ icon: I, t, d }, i) => (
                <li key={t} className="flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><I className="w-4 h-4" /></span>
                  <span><span className="text-[13px] text-muted-foreground">Step {i + 1}</span><span className="block font-semibold text-foreground">{t}</span><span className="text-[13px] text-muted-foreground">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcoming.map((p, i) => <PrepCard key={p.id} prep={p} index={i} />)}
          </div>
          {past.length > 0 && (
            <>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted-foreground pt-4">Past exams</p>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 opacity-80">
                {past.map((p, i) => <PrepCard key={p.id} prep={p} index={i} />)}
              </div>
            </>
          )}
        </>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-muted grid place-items-center"><Link2 className="w-4 h-4" /></span>
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold text-foreground text-[15px]">Got a link from a classmate?</p>
            <p className="text-[13px] text-muted-foreground">Start your own copy of their plan — your progress stays private.</p>
          </div>
          <input value={joinLink} onChange={e => setJoinLink(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} placeholder="Paste the share link"
            className="h-10 w-full sm:w-72 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
          <button onClick={join} className="h-10 px-4 rounded-full border border-border text-sm font-semibold">Open</button>
        </div>
      </Panel>
    </DashPage>
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
      <Link href={`/dashboard/studio/exam-prep/${prep.id}`} className="block group bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] p-5 hover:border-primary/40 transition-colors">
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
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Flame className="w-4 h-4 text-orange-500" /> <span className="tabular-nums text-foreground font-semibold">{prep.streak ?? 0}</span></span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><GraduationCap className="w-4 h-4" /> est. <span className="text-foreground font-semibold">{grade}</span></span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">{items.length ? `${items.length} due` : 'All done'} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
        </div>
      </Link>
    </motion.div>
  );
}
