import type { AdherenceRow } from '@/lib/study/planner';

export function ClassAdherence({ classRate, rows }: { classRate: number; rows: AdherenceRow[] }) {
  return (
    <section aria-label="Class goal adherence" className="rounded-[28px] border border-[#E7EDED] bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">Class</p>
      <h2 className="font-heading text-2xl text-[#203337]">Goal adherence</h2>
      <p className="mt-1 text-sm text-[#1E6A83]">Assigned goals only. Private goals are not included, and titles are not shown.</p>
      <p className="mt-4 font-heading text-4xl text-[#203337]">{classRate}%</p>
      <ul className="mt-4 divide-y divide-[#E7EDED]">
        {rows.length === 0 ? <li className="py-3 text-sm text-[#203337]">No assigned goals in this class yet.</li> : rows.map((row) => (
          <li key={row.studentId} className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-semibold text-[#203337]">{row.name}</span>
            <span className="text-sm text-[#1E6A83]">{row.onTime} of {row.assigned} on time · {row.rate}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
