import type { WeekColumn } from '@/lib/study/planner';
import { sourceLabel } from '@/lib/study/planner';

export function WeeklyPlan({ columns, title = 'This week' }: { columns: WeekColumn[]; title?: string }) {
  return (
    <section aria-label="Weekly study plan" className="rounded-[28px] border border-[#e5ebf2] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#096ab7]">ET AI planner</p>
          <h2 className="font-heading text-2xl text-[#11131b]">{title}</h2>
        </div>
        <p className="text-sm text-[#096ab7]">
          {columns.reduce((sum, day) => sum + day.plannedMinutes, 0)} min planned
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {columns.map((day) => (
          <article key={day.dateKey} className="min-h-40 rounded-2xl border border-[#e5ebf2] bg-[#F7FBFC] p-3">
            <p className="text-sm font-semibold text-[#11131b]">{day.label}</p>
            <p className="mt-1 text-xs text-[#096ab7]">{day.plannedMinutes} min · {day.doneMinutes} done</p>
            <ul className="mt-3 space-y-2">
              {day.goals.length === 0 ? <li className="text-xs text-[#626976]">Free</li> : day.goals.map((goal) => (
                <li key={`${day.dateKey}-${goal.title}`} className="rounded-xl border border-[#096ab7] bg-white px-2 py-1.5">
                  <p className="text-xs font-semibold text-[#11131b]">{goal.title}</p>
                  <p className="text-[10px] text-[#096ab7]">{goal.minutes} min · {sourceLabel(goal.source)}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
