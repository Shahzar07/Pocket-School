'use client';

/**
 * Dashboard primitives.
 *
 * One vocabulary for every dashboard page, drawn from the reference design:
 * white cards on a warm off-white shell, hairline borders, a soft cool lift,
 * and the homepage's ink-and-teal palette rather than a second theme.
 *
 * These are presentation only — no data, no fetching — so a page can adopt the
 * look without changing a line of its behaviour.
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, type LucideIcon } from 'lucide-react';

/* ── Page frame ──────────────────────────────────────────────── */

export function DashPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-[1400px] mx-auto space-y-5 pb-12 ${className}`}>{children}</div>;
}

export function DashHeader({
  eyebrow, title, accent, description, actions,
}: {
  eyebrow?: string;
  title: string;
  /** Rendered in teal after the title, the way the homepage emphasises. */
  accent?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.21, 0.6, 0.35, 1] }}
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2">{eyebrow}</p>
        )}
        <h1 className="font-heading text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.04em] text-foreground">
          {title}{accent && <> <span className="text-primary">{accent}</span></>}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </motion.header>
  );
}

/* ── Surfaces ────────────────────────────────────────────────── */

export function Panel({
  children, className = '', padded = true,
}: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section
      className={`bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title, meta, action,
}: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
      <div className="flex items-center gap-2 shrink-0">
        {meta}
        {action}
      </div>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────── */

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Small pill beside the label, e.g. "Active". */
  badge?: string;
  /** Progress row under the value, 0-100. */
  progress?: number;
  progressLabel?: string;
  /** Link row under the value, mutually exclusive with progress. */
  href?: string;
  hrefLabel?: string;
  index?: number;
}

export function StatCard({
  icon: Icon, label, value, badge, progress, progressLabel, href, hrefLabel, index = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.21, 0.6, 0.35, 1] }}
      className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] p-5 flex flex-col"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-8 h-8 rounded-xl border border-border grid place-items-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </span>
        <span className="text-[13px] font-medium text-muted-foreground truncate">{label}</span>
        {badge && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />{badge}
          </span>
        )}
      </div>

      <p className="text-[34px] leading-none font-semibold tracking-[-0.04em] text-foreground tabular-nums">
        {value}
      </p>

      {typeof progress === 'number' && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>{progressLabel ?? 'Progress'}</span>
            <span className="font-semibold text-foreground tabular-nums">{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      {href && (
        <Link
          href={href}
          className="mt-4 flex items-center justify-between gap-2 h-9 px-3 rounded-xl border border-border text-[12px] font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {hrefLabel ?? 'View all'} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </motion.div>
  );
}

/* ── Bits ────────────────────────────────────────────────────── */

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 rounded-full bg-muted overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-muted">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`h-7 px-3 rounded-[10px] text-[12px] font-semibold transition-colors ${
            value === o.id
              ? 'bg-card text-foreground shadow-[var(--shadow-card)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Round-cornered avatar tile used in list rows, initials derived from a name. */
export function Initials({ name, className = '' }: { name: string; className?: string }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  return (
    <span
      className={`shrink-0 w-9 h-9 rounded-xl bg-secondary text-secondary-foreground grid place-items-center text-[11px] font-bold ${className}`}
    >
      {letters}
    </span>
  );
}

/** A single row inside a Panel list — icon/initials, title, subtitle, trailing. */
export function ListRow({
  leading, title, subtitle, trailing, href,
}: {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors">
      {leading}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

/** Stacked proportion bar with a legend, as in the reference breakdown card. */
export function StackedBar({
  segments,
}: { segments: { label: string; value: number; className: string }[] }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  return (
    <div>
      <div className="flex h-7 rounded-lg overflow-hidden gap-0.5">
        {segments.map(s => (
          <div
            key={s.label}
            className={s.className}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
        {segments.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-sm ${s.className}`} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Empty state used inside panels and tables. */
export function EmptyState({
  icon: Icon, title, body, action,
}: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <span className="w-11 h-11 rounded-2xl border border-border grid place-items-center mx-auto mb-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </span>
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      {body && <p className="text-[12px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Table shell — header row styling and horizontal scroll in one place. */
export function DataTable({
  head, children, minWidth = 860,
}: { head: ReactNode; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
