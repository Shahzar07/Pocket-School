import type { WeekColumn } from '@/lib/study/planner';
import { sourceLabel } from '@/lib/study/planner';

export function WeeklyPlan({ columns, title = 'This week' }: { columns: WeekColumn[]; title?: string }) {
  return (
    <section aria-label="Weekly study plan" className="rounded-[28px] border border-[#E7EDED] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">ET AI planner</p>
          <h2 className="font-heading text-2xl text-[#203337]">{title}</h2>
        </div>
        <p className="text-sm text-[#1E6A83]">
          {columns.reduce((sum, day) => sum + day.plannedMinutes, 0)} min planned
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {columns.map((day) => (
          <article key={day.dateKey} className="min-h-40 rounded-2xl border border-[#E7EDED] bg-[#F7FBFC] p-3">
            <p className="text-sm font-semibold text-[#203337]">{day.label}</p>
            <p className="mt-1 text-xs text-[#1E6A83]">{day.plannedMinutes} min · {day.doneMinutes} done</p>
            <ul className="mt-3 space-y-2">
              {day.goals.length === 0 ? <li className="text-xs text-[#5F7074]">Free</li> : day.goals.map((goal) => (
                <li key={`${day.dateKey}-${goal.title}`} className="rounded-xl border border-[#1E6A83] bg-white px-2 py-1.5">
                  <p className="text-xs font-semibold text-[#203337]">{goal.title}</p>
                  <p className="text-[10px] text-[#1E6A83]">{goal.minutes} min · {sourceLabel(goal.source)}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
