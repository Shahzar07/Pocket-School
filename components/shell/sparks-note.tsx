import { sparksCostLine } from '@/lib/design/system';

export function SparksNote({ cost, balance }: { cost: number; balance?: number }) {
  const locked = balance != null && cost > 0 && balance < cost;
  return (
    <p className={`text-[12px] leading-relaxed ${locked ? 'text-[var(--ps-tile-ink)]' : 'text-muted-foreground'}`} role="status">
      {sparksCostLine(cost, balance)}
    </p>
  );
}
