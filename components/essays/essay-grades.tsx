import type { EssayMark } from '@/lib/essays/mark';

/** School marks keep 9–1. Other levels show the scale for that level. */
export function EssayGrades({ mark }: { mark: EssayMark }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold" data-testid="essay-grades">
        {mark.scaleHeadline
          ? `${mark.estimateLabel ? `${mark.estimateLabel}. ` : ''}${mark.scaleHeadline}${mark.showsPercentage === false ? '' : ` · ${mark.percent}%`}`
          : `${mark.grade91} on 9–1 · ${mark.gradeAU} on A*/A/B/C/D/E/U · ${mark.percent}%`}
      </p>
      {mark.scaleDetail ? <p className="text-sm text-muted-foreground">{mark.scaleDetail}</p> : null}
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
