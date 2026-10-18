export function ParentPlanCard({
  childName,
  planned,
  actual,
  onTime,
  open,
  missed,
  rate,
  streak,
}: {
  childName: string;
  planned: number;
  actual: number;
  onTime: number;
  open: number;
  missed: number;
  rate: number;
  streak: number;
}) {
  const width = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
  return (
    <section aria-label={`${childName} goals`} className="rounded-[28px] border border-[#E7EDED] bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">Today</p>
      <h2 className="font-heading text-2xl text-[#203337]">{childName}</h2>
      <p className="mt-1 text-sm text-[#1E6A83]">Plan against what was finished. Self-set goals are included.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7EDED]" aria-hidden>
        <div className="h-full rounded-full bg-[#3FE0D0]" style={{ width: `${width}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Planned', `${planned} min`],
          ['Studied', `${actual} min`],
          ['On time', String(onTime)],
          ['Still open', String(open)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[#F7FBFC] px-3 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-[#1E6A83]">{label}</dt>
            <dd className="font-heading text-xl text-[#203337]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-[#203337]">
        {rate}% of visible goals are done. Streak {streak} {streak === 1 ? 'day' : 'days'}.
        {missed > 0 ? ` ${missed} missed and moved to catch-up.` : ''}
      </p>
    </section>
  );
}
