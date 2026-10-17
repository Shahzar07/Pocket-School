'use client';

/**
 * The two things most worth doing today, at the top of the student
 * dashboard: the next exam's plan, and the maths tutor.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Camera, Target, Flame, ArrowRight, CalendarDays, Puzzle, BookMarked, Sparkles } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { listPreps } from '@/lib/study/db';
import { daysBetween, dueToday, isoDay } from '@/lib/study/schedule';
import { weightedMastery } from '@/lib/study/grades';
import type { ExamPrep } from '@/lib/study/types';

export function StudyLaunchpad() {
  const { user } = useAuthSTORE();
  const [next, setNext] = useState<ExamPrep | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    const today = isoDay();
    listPreps(user.uid)
      .then(ps => setNext(ps.filter(p => p.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate))[0] ?? null))
      .catch(() => setNext(null));
  }, [user]);

  const today = isoDay();
  const due = next ? dueToday(next.plan, next.completed ?? {}, today).items.length : 0;
  const mastery = next ? weightedMastery(next.topics, next.mastery ?? {}) : 0;
  const left = next ? daysBetween(today, next.examDate) : 0;

  return (
    <div className="grid md:grid-cols-[1.35fr_1fr] gap-4">
      <motion.div data-tour="study-exam-prep" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white bg-gradient-to-br from-[#0f2f3a] via-[#15475a] to-[#1E6A83] shadow-[var(--shadow-card)]">
        <div className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        {next === undefined ? (
          <div className="h-32 animate-pulse rounded-xl bg-white/10" />
        ) : next ? (
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 inline-flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Next exam · {left === 0 ? 'today' : `${left} day${left === 1 ? '' : 's'}`}</p>
            <p className="font-heading text-[26px] leading-tight mt-1.5 line-clamp-1">{next.title}</p>
            <div className="mt-4 flex items-center gap-5 text-[13px] text-white/80">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {due ? `${due} to do today` : 'Today done ✓'}</span>
              <span className="inline-flex items-center gap-1.5"><Flame className="w-4 h-4 text-[var(--ps-cyan-text)]" /> {next.streak ?? 0} day streak</span>
            </div>
            <div className="mt-4 relative h-2 rounded-full bg-white/15">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${mastery}%` }} />
              <span className="absolute -top-1 w-0.5 h-4 bg-rose-300 rounded" style={{ left: `${next.targetScore}%` }} />
            </div>
            <p className="text-[12px] text-white/60 mt-1.5">{mastery}% mastered · target {next.targetGrade}</p>
            <Link href={`/dashboard/studio/exam-prep/${next.id}`} className="mt-4 inline-flex h-10 px-4 rounded-full bg-white text-[#0f2f3a] text-[13px] font-semibold items-center gap-1.5 hover:bg-white/90">
              {due ? 'Continue today’s plan' : 'Open my plan'} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Exam Prep</p>
            <p className="font-heading text-[26px] leading-tight mt-1.5">Your notes in.<br />Your study plan out.</p>
            <p className="text-[13px] text-white/70 mt-2 max-w-md">Upload notes, slides or past papers and set your exam date — ET AI builds a day-by-day plan with lessons, quizzes, podcasts and a mock.</p>
            <Link href="/dashboard/studio/exam-prep/new" className="mt-4 inline-flex h-10 px-4 rounded-full bg-white text-[#0f2f3a] text-[13px] font-semibold items-center gap-1.5 hover:bg-white/90">
              <Sparkles className="w-4 h-4" /> Create my plan
            </Link>
          </div>
        )}
      </motion.div>

      <motion.div data-tour="study-maths" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl p-5 sm:p-6 bg-card border border-border shadow-[var(--shadow-card)] flex flex-col">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">ET Maths</p>
        <p className="font-heading text-[24px] leading-tight mt-1.5">Stuck on a problem?</p>
        <p className="text-[13px] text-muted-foreground mt-1">Snap it. ET AI walks you through it, one step at a time.</p>
        <Link href="/dashboard/studio/maths" className="mt-4 inline-flex h-10 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold items-center gap-1.5 w-fit hover:opacity-90">
          <Camera className="w-4 h-4" /> Scan a problem
        </Link>
        <div className="mt-auto pt-4 flex flex-wrap gap-2 text-[12px] font-semibold">
          <Link href="/dashboard/studio/maths/packs" className="h-8 px-3 rounded-full border border-border inline-flex items-center gap-1.5 hover:border-primary/40"><BookMarked className="w-3.5 h-3.5 text-primary" /> SPM · IGCSE · A Level packs</Link>
          <Link href="/dashboard/studio/maths/lab" className="h-8 px-3 rounded-full border border-border inline-flex items-center gap-1.5 hover:border-primary/40"><Puzzle className="w-3.5 h-3.5 text-primary" /> Today&apos;s puzzle</Link>
        </div>
      </motion.div>
    </div>
  );
}
