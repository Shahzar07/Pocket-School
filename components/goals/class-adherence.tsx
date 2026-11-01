import type { AdherenceRow } from '@/lib/study/planner';

export function ClassAdherence({ classRate, rows }: { classRate: number; rows: AdherenceRow[] }) {
  return (
    <section aria-label="Class goal adherence" className="rounded-[28px] border border-[#e5ebf2] bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#096ab7]">Class</p>
      <h2 className="font-heading text-2xl text-[#11131b]">Goal adherence</h2>
      <p className="mt-1 text-sm text-[#096ab7]">Every goal counts, including ones a student set. Titles are on the student list.</p>
      <p className="mt-4 font-heading text-4xl text-[#11131b]">{classRate}%</p>
      <ul className="mt-4 divide-y divide-[#e5ebf2]">
        {rows.length === 0 ? <li className="py-3 text-sm text-[#11131b]">No goals in this class yet.</li> : rows.map((row) => (
          <li key={row.studentId} className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-semibold text-[#11131b]">{row.name}</span>
            <span className="text-sm text-[#096ab7]">{row.onTime} of {row.assigned} on time · {row.rate}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
