'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, Plus, Search } from 'lucide-react';
import type { ShelfBadge, ShelfItem } from '@/lib/shelf/types';
import { BookCover } from './book-cover';

const TONE: Record<ShelfBadge['tone'], string> = {
  free: 'bg-primary text-primary-foreground',
  included: 'bg-secondary text-primary',
  buy: 'bg-white text-[#203337]',
  owned: 'bg-foreground text-background',
  locked: 'bg-white text-[#203337]',
  preview: 'bg-white text-[#203337]',
};

export function ShelfBadgePill({ badge }: { badge: ShelfBadge }) {
  return (
    <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[badge.tone]}`}>
      {badge.label}
    </span>
  );
}

export function Poster({ item, rank }: { item: ShelfItem; rank?: number }) {
  return (
    <Link href={item.href} className="group relative block w-[168px] shrink-0 snap-start sm:w-[186px] [content-visibility:auto] [contain-intrinsic-size:186px_320px]">
      {typeof rank === 'number' && (
        <span className="pointer-events-none absolute -left-3 bottom-8 z-10 font-heading text-[84px] leading-none text-[#203337]/90 drop-shadow-[0_2px_0_#fff]" aria-hidden>
          {rank}
        </span>
      )}
      <div className={`relative overflow-hidden rounded-xl shadow-[var(--shadow-card)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)] ${rank ? 'ml-8' : ''}`}>
        {item.kind === 'book' && item.cover ? (
          <BookCover title={item.title} cover={item.cover} className="aspect-[2/3] w-full" />
        ) : (
          <div className="relative aspect-[16/10] bg-muted">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
        {typeof item.progress === 'number' && item.progress > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
            <span className="block h-full bg-primary" style={{ width: `${Math.min(100, item.progress)}%` }} />
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground group-hover:text-primary">{item.title}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <ShelfBadgePill badge={item.badge} />
        </div>
      </div>
    </Link>
  );
}

export function ShelfRow({
  title, items, ranked = false, action,
}: {
  title: string;
  items: ShelfItem[];
  ranked?: boolean;
  action?: { href: string; label: string };
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className="font-heading text-[22px] tracking-[-0.03em] text-foreground sm:text-[26px]">{title}</h2>
        {action && <Link href={action.href} className="text-[12px] font-semibold text-primary">{action.label}</Link>}
      </div>
      <div className="flex gap-4 overflow-x-auto scroll-px-1 px-1 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => <Poster key={item.id} item={item} rank={ranked ? i + 1 : undefined} />)}
      </div>
    </section>
  );
}

export function Hero({
  eyebrow, title, description, badges, primary, listed, onToggleList, listLabel, listedLabel, visual,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges: ShelfBadge[];
  primary: { href: string; label: string };
  listed: boolean;
  onToggleList: () => void;
  listLabel: string;
  listedLabel: string;
  visual: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border bg-primary text-primary-foreground shadow-[var(--shadow-card-hover)]">
      <div className="grid lg:grid-cols-[1.3fr_0.9fr]">
        <div className="relative z-10 flex flex-col justify-end p-6 sm:p-10 lg:min-h-[440px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-secondary">{eyebrow}</p>
          <h1 className="mt-3 max-w-xl font-heading text-[40px] leading-[0.98] tracking-[-0.04em] sm:text-[58px]">{title}</h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-primary-foreground/90 sm:text-[15px]">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map(b => <span key={b.label} className="rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">{b.label}</span>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={primary.href} className="inline-flex h-11 items-center rounded-full border border-primary bg-white px-5 text-sm font-bold text-[#203337]">
              {primary.label}
            </Link>
            <button
              type="button"
              onClick={onToggleList}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-primary-foreground/30 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              {listed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {listed ? listedLabel : listLabel}
            </button>
          </div>
        </div>
        <div className="relative min-h-[240px] lg:min-h-full">{visual}</div>
      </div>
    </section>
  );
}

export function SearchField({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 shadow-[var(--shadow-card)]">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function Chip({
  active, children, onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold ${active ? 'bg-[#203337] text-white' : 'bg-card text-muted-foreground border border-border'}`}
    >
      {children}
    </button>
  );
}

export function ResultGrid({ items }: { items: ShelfItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(item => <Poster key={item.id} item={item} />)}
    </div>
  );
}
