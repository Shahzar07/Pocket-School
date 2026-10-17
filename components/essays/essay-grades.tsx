import type { EssayMark } from '@/lib/essays/mark';

/** A marked essay always shows the 9–1 grade, the letter, and the percentage. */
export function EssayGrades({ mark }: { mark: EssayMark }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold" data-testid="essay-grades">
        {mark.grade91} on 9–1 · {mark.gradeAU} on A*/A/B/C/D/E/U · {mark.percent}%
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Score label="Percentage" value={`${mark.percent}%`} />
        <Score label="9–1" value={mark.grade91} />
        <Score label="Letter" value={mark.gradeAU} />
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl tracking-[-0.04em]">{value}</p>
    </div>
  );
}
