'use client';

/**
 * A parent's read-only view of a child's exam preparation: what's coming
 * up, how ready they are against their own target, whether they're keeping
 * the habit, and how their last mock went.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Target, Flame, GraduationCap, CalendarDays } from 'lucide-react';
import { listAttempts, listPreps } from '@/lib/study/db';
import { daysBetween, isoDay, parseDay } from '@/lib/study/schedule';
import { gradeFor, weightedMastery } from '@/lib/study/grades';
import type { ExamAttempt, ExamPrep } from '@/lib/study/types';

export function ChildExamPrep({ childId, name }: { childId: string; name?: string }) {
  const [rows, setRows] = useState<{ prep: ExamPrep; last?: ExamAttempt }[] | null>(null);

  useEffect(() => {
    const today = isoDay();
    listPreps(childId)
      .then(async ps => {
        const upcoming = ps.filter(p => p.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate)).slice(0, 4);
        const withAttempts = await Promise.all(upcoming.map(async prep => ({ prep, last: (await listAttempts(childId, prep.id).catch(() => []))[0] })));
        setRows(withAttempts);
      })
      .catch(() => setRows([]));
  }, [childId]);

  if (!rows || rows.length === 0) return null;
  const first = name?.split(' ')[0] ?? 'Your child';
  const today = isoDay();

  return (
    <div className="mt-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Exam preparation</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map(({ prep, last }, i) => {
          const mastery = weightedMastery(prep.topics, prep.mastery ?? {});
          const left = daysBetween(today, prep.examDate);
          const studiedRecently = (prep.lastStudyDay ?? '') >= isoDay(new Date(Date.now() - 2 * 86_400_000));
          return (
            <motion.div key={prep.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary truncate">{prep.subject || 'Exam'}</p>
                  <p className="font-semibold text-foreground leading-snug truncate">{prep.title}</p>
                </div>
                <span className={`shrink-0 text-[12px] font-bold px-2 py-0.5 rounded-full ${left <= 3 ? 'bg-rose-50 text-rose-700' : 'bg-primary/10 text-primary'}`}>{left === 0 ? 'Today' : `${left}d`}</span>
              </div>
              <div className="mt-3 relative h-2 rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${mastery}%` }} />
                <span className="absolute -top-1 w-0.5 h-4 bg-rose-400 rounded" style={{ left: `${prep.targetScore}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {mastery}% ready · aim {prep.targetGrade}</span>
                <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-[var(--ps-cyan-text)]" /> {prep.streak ?? 0}-day streak</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {parseDay(prep.examDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <span className="inline-flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {last ? `Last ${last.kind}: ${last.grade ?? gradeFor(prep.gradeScale, last.percent)}` : 'No mock yet'}</span>
              </div>
              {!studiedRecently && left > 0 && (
                <p className="mt-3 text-[12px] rounded-lg bg-[var(--ps-cyan-soft)] border border-[var(--ps-cyan-border)] text-[var(--ps-cyan-text)] px-2.5 py-1.5">{first} hasn&apos;t studied for this in a few days — a little encouragement could help.</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
