'use client';

import { QUESTS } from '@/lib/gamification/catalog';

export function QuestList({
  progress,
  done,
  periodDay,
  periodWeek,
}: {
  progress: Record<string, number>;
  done: readonly string[];
  periodDay: string;
  periodWeek: string;
}) {
  return (
    <ul className="space-y-3">
      {QUESTS.map(quest => {
        const period = quest.cadence === 'daily' ? periodDay : periodWeek;
        const key = `${quest.id}:${period}`;
        const value = Math.min(quest.target, progress[key] ?? 0);
        const complete = done.includes(key) || value >= quest.target;
        return (
          <li key={quest.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-heading text-base text-foreground">{quest.title}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8922A]">{quest.cadence}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{complete ? 'Done' : `${value} of ${quest.target}`}</p>
            <div className="mt-2 h-2 rounded-full bg-[#1A3C34]/10" aria-hidden="true">
              <div className="h-2 rounded-full bg-[#C8922A]" style={{ width: `${(value / quest.target) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
