import Link from 'next/link';
import type { ReactNode } from 'react';
import { StickyNote } from 'lucide-react';
import { ALERT_TONE, CATEGORY_STYLE, type AlertTone, type DashCategory } from '@/lib/dashboard/home';
import { CategoryIcon } from './icons';

export function DashSkeleton({ className = '' }: { className?: string }) {
  return <div className={`ps-skeleton rounded-[18px] ${className}`} aria-hidden="true" />;
}

export function Sparkline({ series, label }: { series: number[]; label: string }) {
  const width = 88;
  const height = 32;
  const max = Math.max(...series, 1);
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const points = series.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="dash-motion">
      <polyline
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const size = 52;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (circumference * clamped) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="dash-motion -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  hint,
  series,
  ring,
}: {
  label: string;
  value: string;
  hint?: string;
  series?: number[];
  ring?: number;
}) {
  return (
    <article className="ps-surface ps-rise flex min-h-12 items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-4xl tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {typeof ring === 'number' ? <ProgressRing value={ring} label={`${label} ${ring}%`} /> : null}
      {series && series.length > 1 && typeof ring !== 'number' ? <Sparkline series={series} label={label} /> : null}
    </article>
  );
}

export function AlertCard({ tone, title, detail }: { tone: AlertTone; title: string; detail: string }) {
  const style = ALERT_TONE[tone];
  return (
    <article
      className="rounded-[18px] px-4 py-3"
      style={{ background: style.wash, color: style.ink }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em]">{style.label}</p>
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm">{detail}</p>
    </article>
  );
}

export function ListCard({ title, rows }: { title: string; rows: { id: string; title: string; detail: string }[] }) {
  return (
    <section className="ps-surface p-4">
      <h2 className="font-heading text-xl text-foreground">{title}</h2>
      {rows.length === 0 ? <EmptyState title="Nothing waiting" detail="When something needs you, it will show up here." /> : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map(row => (
            <li key={row.id} className="flex min-h-12 flex-col justify-center py-3">
              <p className="font-semibold text-foreground">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <EmptyIllustration />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" aria-hidden="true" className="shrink-0">
      <rect x="8" y="10" width="36" height="40" rx="8" fill="var(--ps-wash)" />
      <rect x="16" y="20" width="20" height="3" rx="1.5" fill="var(--ps-blue-deep)" />
      <rect x="16" y="28" width="16" height="3" rx="1.5" fill="var(--ps-blue-bright)" />
      <circle cx="52" cy="22" r="12" fill="var(--ps-mint)" />
      <path d="M47 22.5 l3 3 7-7" fill="none" stroke="var(--ps-mint-ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TileLink({
  href,
  label,
  hint,
  category,
  badge,
  icon,
  children,
}: {
  href: string;
  label: string;
  hint?: string;
  category: DashCategory;
  badge?: number;
  icon?: 'sticky-note';
  children?: ReactNode;
}) {
  const style = CATEGORY_STYLE[category];
  return (
    <div className="ps-rise relative flex flex-col gap-2 rounded-[24px] border border-[var(--ps-card-edge)] p-4" style={{ background: style.wash }}>
      <Link
        href={href}
        className="flex min-h-12 flex-col justify-between gap-3 text-foreground transition-transform motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
      >
        <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-card shadow-[var(--shadow-card)]" style={{ color: style.ink }}>
          {icon === 'sticky-note' ? <StickyNote className="h-6 w-6" strokeWidth={1.75} aria-hidden /> : <CategoryIcon category={category} />}
        </span>
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
        </span>
      </Link>
      {badge && badge > 0 ? (
        <span className="absolute end-3 top-3 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function BadgeArt({ label, earned }: { label: string; earned: boolean }) {
  return (
    <div className={`flex min-h-12 items-center gap-3 rounded-[18px] border border-border px-3 py-2 ${earned ? 'bg-card' : 'bg-muted/50'}`}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="16" r="10" fill={earned ? 'var(--medal-first)' : 'var(--muted)'} />
        <path d="M12 24 l6 8 6-8" fill={earned ? 'var(--medal-bronze)' : 'var(--border)'} />
        <circle cx="18" cy="16" r="4" fill={earned ? 'var(--medal-first-ink)' : 'var(--muted-foreground)'} />
      </svg>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{earned ? 'Yours' : 'Still ahead'}</p>
      </div>
    </div>
  );
}

export function InsightMap() {
  return (
    <section className="ps-surface p-4">
      <h2 className="font-heading text-xl text-foreground">Where learners are active</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sample regions. A school’s own map uses only the region it has saved.</p>
      <svg viewBox="0 0 320 140" className="mt-3 h-36 w-full" role="img" aria-label="Sample map of active regions">
        <rect width="320" height="140" rx="18" fill="var(--ps-wash)" />
        <path d="M40 90 C70 40 120 30 160 55 C200 80 250 40 290 70" fill="none" stroke="var(--chart-1)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="92" cy="58" r="7" fill="var(--chart-2)" />
        <circle cx="168" cy="62" r="9" fill="var(--chart-5)" />
        <circle cx="236" cy="54" r="6" fill="var(--chart-5)" />
      </svg>
    </section>
  );
}
