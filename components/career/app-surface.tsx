'use client';

/**
 * Career screens follow the shared dashboard kit.
 * Swap these for `TileLink`, `ProgressRing`, `StatCard`, and `CategoryIcon`
 * from `components/dashboard` when that kit is on this branch.
 * Props and class names match that kit.
 */

import { useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  CreditCard,
  Menu,
  Shield,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export type CareerCategory = 'learning' | 'progress' | 'careers' | 'payments' | 'community' | 'people' | 'safety' | 'insights';

const STYLE: Record<CareerCategory, { wash: string; ink: string; icon: LucideIcon }> = {
  learning: { wash: 'var(--ps-wash)', ink: 'var(--ps-blue-deep)', icon: BookOpen },
  progress: { wash: 'var(--ps-mint)', ink: 'var(--ps-mint-ink)', icon: Activity },
  careers: { wash: 'var(--ps-cyan-soft)', ink: 'var(--ps-cyan-text)', icon: Briefcase },
  payments: { wash: 'var(--ps-cyan-soft)', ink: 'var(--ps-cyan-text)', icon: CreditCard },
  community: { wash: 'var(--ps-wash)', ink: 'var(--ps-violet)', icon: Users },
  people: { wash: 'var(--ps-wash)', ink: 'var(--ps-blue-deep)', icon: UsersRound },
  safety: { wash: 'var(--ps-coral-soft)', ink: 'var(--ps-coral)', icon: Shield },
  insights: { wash: 'var(--ps-mint)', ink: 'var(--ps-mint-ink)', icon: BarChart3 },
};

export function CategoryIcon({ category, className = 'h-6 w-6' }: { category: CareerCategory; className?: string }) {
  const Icon = STYLE[category].icon;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const size = 52;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (circumference * clamped) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90 motion-reduce:transition-none">
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

export function StatCard({ label, value, hint, ring }: { label: string; value: string; hint?: string; ring?: number }) {
  return (
    <article className="flex min-h-12 items-center justify-between gap-3 rounded-[18px] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {typeof ring === 'number' ? <ProgressRing value={ring} label={`${label} ${ring}%`} /> : null}
    </article>
  );
}

export interface CareerTile {
  id: string;
  label: string;
  hint?: string;
  category: CareerCategory;
  badge?: number;
}

export function CareerHome({
  title,
  blurb,
  tasks,
  tiles,
  stats,
  active,
  onActive,
  children,
}: {
  title: string;
  blurb: string;
  tasks: { id: string; label: string; category: CareerCategory; onSelect: () => void }[];
  tiles: CareerTile[];
  stats: { label: string; value: string; hint?: string; ring?: number }[];
  active: string;
  onActive: (id: string) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [more, setMore] = useState(false);
  const tabs = tiles.slice(0, 4);
  const rest = tiles.slice(4);

  return (
    <div className="dash-kit text-foreground">
      <div className="lg:flex lg:items-start lg:gap-4">
        <aside className={`mb-4 hidden shrink-0 rounded-[24px] border border-sidebar-border bg-sidebar p-2 lg:block ${collapsed ? 'w-[76px]' : 'w-[232px]'}`}>
          <button
            type="button"
            className="grid h-12 w-12 place-items-center rounded-[18px] hover:bg-muted"
            aria-label={collapsed ? 'Expand sections' : 'Collapse sections'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Menu className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <nav aria-label="Career sections" className="mt-1 space-y-1">
            <SectionButton id="home" label="Home" category="learning" collapsed={collapsed} active={active === 'home'} onSelect={() => onActive('home')} />
            {tiles.map((tile) => (
              <SectionButton key={tile.id} {...tile} collapsed={collapsed} active={active === tile.id} onSelect={() => onActive(tile.id)} />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-5 pb-24 lg:pb-6">
          <header
            className="relative overflow-hidden rounded-[24px] px-5 py-6 text-primary-foreground"
            style={{
              background: 'linear-gradient(100deg, color-mix(in srgb, var(--ps-blue-deep) 94%, transparent) 0%, color-mix(in srgb, var(--ps-blue-deep) 72%, transparent) 55%, color-mix(in srgb, var(--ps-blue-deep) 40%, transparent) 100%), var(--ps-hero)',
            }}
          >
            <p className="text-sm font-medium">Poket School</p>
            <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
            <p className="mt-1 max-w-xl text-sm">{blurb}</p>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {tasks.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={task.onSelect}
                  className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-foreground"
                >
                  <span style={{ color: STYLE[task.category].ink }}><CategoryIcon category={task.category} className="h-6 w-6" /></span>
                  {task.label}
                </button>
              ))}
            </div>
          </header>

          {active === 'home' ? (
            <>
              <section aria-label="Start here" className="grid gap-3 sm:grid-cols-3">
                {tasks.slice(0, 3).map((task) => (
                  <button key={task.id} type="button" onClick={task.onSelect} className="rounded-[18px] p-4 text-start" style={{ background: STYLE[task.category].wash }}>
                    <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-card shadow-[var(--shadow-card)]" style={{ color: STYLE[task.category].ink }}>
                      <CategoryIcon category={task.category} />
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-foreground">{task.label}</span>
                  </button>
                ))}
              </section>
              {stats.length > 0 ? (
                <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
                  {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
                </section>
              ) : null}
              <section aria-label="More">
                <h2 className="mb-3 font-heading text-xl text-foreground">More</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {tiles.map((tile) => (
                    <TileButton key={tile.id} {...tile} onSelect={() => onActive(tile.id)} />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-[24px] border border-border bg-card p-4">{children}</section>
          )}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-card lg:hidden" aria-label="Career">
        <TabButton label="Home" category="learning" active={active === 'home'} onSelect={() => { setMore(false); onActive('home'); }} />
        {tabs.slice(0, 3).map((tile) => (
          <TabButton key={tile.id} label={tile.label} category={tile.category} badge={tile.badge} active={active === tile.id} onSelect={() => { setMore(false); onActive(tile.id); }} />
        ))}
        <TabButton label="More" category="insights" active={more} onSelect={() => setMore((value) => !value)} />
      </nav>
      {more ? (
        <div className="fixed inset-x-3 bottom-20 z-30 grid grid-cols-2 gap-2 rounded-[24px] border border-border bg-card p-3 shadow-[var(--shadow-card)] lg:hidden">
          {rest.map((tile) => (
            <TileButton key={tile.id} {...tile} onSelect={() => { setMore(false); onActive(tile.id); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TileButton({ label, hint, category, badge, onSelect }: CareerTile & { onSelect: () => void }) {
  const style = STYLE[category];
  return (
    <button type="button" onClick={onSelect} className="relative flex min-h-12 flex-col justify-between gap-3 rounded-[18px] p-4 text-start text-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none" style={{ background: style.wash }}>
      <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-card shadow-[var(--shadow-card)]" style={{ color: style.ink }}>
        <CategoryIcon category={category} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {badge && badge > 0 ? (
        <span className="absolute end-3 top-3 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}

function SectionButton({
  label, category, badge, collapsed, active, onSelect,
}: CareerTile & { collapsed: boolean; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onSelect}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[18px] px-3 text-sm font-medium ${active ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted'}`}
    >
      <span style={{ color: STYLE[category].ink }}><CategoryIcon category={category} /></span>
      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
      {!collapsed && badge && badge > 0 ? (
        <span className="ms-auto grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{badge > 9 ? '9+' : badge}</span>
      ) : null}
    </button>
  );
}

function TabButton({
  label, category, badge, active, onSelect,
}: { label: string; category: CareerCategory; badge?: number; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
      <span style={{ color: STYLE[category].ink }}><CategoryIcon category={category} /></span>
      {label}
      {badge && badge > 0 ? (
        <span className="absolute end-2 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{badge > 9 ? '9+' : badge}</span>
      ) : null}
    </button>
  );
}

export const fieldClass = 'mt-1 h-12 w-full rounded-[18px] border border-border bg-background px-3 text-sm text-foreground';
export const primaryButton = 'inline-flex min-h-12 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground';
export const quietButton = 'inline-flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground';
