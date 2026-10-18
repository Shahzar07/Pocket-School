'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { PlanDay } from '@/lib/study/types';
import { addDays, isoDay, parseDay } from '@/lib/study/schedule';

/**
 * Seven days around today, each with a ring showing how much of that day's
 * plan is done — the at-a-glance "am I on track" that keeps a plan alive.
 */
export function WeekStrip({ plan, completed, examDate, selected, onSelect }: {
  plan: PlanDay[];
  completed: Record<string, boolean>;
  examDate: string;
  selected?: string;
  onSelect?: (day: string) => void;
}) {
  const today = isoDay();
  const start = addDays(today, -2);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDate = new Map(plan.map(d => [d.date, d]));

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map(day => {
        const items = byDate.get(day)?.items ?? [];
        const done = items.filter(i => completed[i.id]).length;
        const pct = items.length ? done / items.length : 0;
        const isToday = day === today;
        const isExam = day === examDate;
        const full = items.length > 0 && done === items.length;
        const d = parseDay(day);
        const R = 15, C = 2 * Math.PI * R;
        return (
          <button
            key={day}
            onClick={() => onSelect?.(day)}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors ${selected === day ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
          >
            <span className={`text-[11px] font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
              {d.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span className="relative w-10 h-10 grid place-items-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r={R} fill="none" stroke="var(--border)" strokeWidth="2.5" strokeDasharray={items.length ? undefined : '2 3'} />
                {pct > 0 && (
                  <motion.circle cx="18" cy="18" r={R} fill="none" stroke={full ? '#30A46C' : 'var(--primary)'} strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct) }} transition={{ duration: 0.8 }} />
                )}
              </svg>
              {full ? (
                <Check className="w-4 h-4 text-success" strokeWidth={3} />
              ) : isExam ? (
                <span className="text-sm">🎓</span>
              ) : (
                <span className={`text-[13px] font-semibold tabular-nums ${isToday ? 'w-7 h-7 rounded-full bg-primary text-primary-foreground grid place-items-center' : 'text-foreground'}`}>{d.getDate()}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
