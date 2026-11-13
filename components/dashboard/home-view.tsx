'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Scene } from '@/components/poket-home/Brand';
import './home-view.css';
import {
  applyTileOrder,
  CATEGORY_STYLE,
  greetingFor,
  moveTile,
  roleHome,
  type DashRole,
} from '@/lib/dashboard/home';
import type { PreviewAlert, PreviewBadge, PreviewChild, PreviewRow, PreviewStat } from '@/lib/dashboard/preview';
import { AlertCard, BadgeArt, DashSkeleton, InsightMap, ListCard, StatCard, TileLink } from './cards';
import { CategoryIcon } from './icons';

export function HomeView({
  role,
  name,
  hour = 9,
  stats,
  alerts,
  rows,
  listTitle,
  children = [],
  badges = [],
  showMap = false,
  tileOrder,
  onTileOrder,
  loading = false,
  showCoach = false,
  onDismissCoach,
  arranging = false,
  onArrange,
}: {
  role: DashRole;
  name: string;
  hour?: number;
  stats: PreviewStat[];
  alerts: PreviewAlert[];
  rows: PreviewRow[];
  listTitle: string;
  children?: PreviewChild[];
  badges?: PreviewBadge[];
  showMap?: boolean;
  tileOrder?: string[];
  onTileOrder?: (order: string[]) => void;
  loading?: boolean;
  showCoach?: boolean;
  onDismissCoach?: () => void;
  arranging?: boolean;
  onArrange?: (next: boolean) => void;
}) {
  const home = roleHome(role);
  const tiles = applyTileOrder(home.tiles, tileOrder ?? home.tiles.map(tile => tile.id));
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const selected = children.find(child => child.id === childId) ?? children[0];

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your home">
        <DashSkeleton className="h-40" />
        <div className="grid gap-3 sm:grid-cols-3">
          <DashSkeleton className="h-24" />
          <DashSkeleton className="h-24" />
          <DashSkeleton className="h-24" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DashSkeleton className="h-32" />
          <DashSkeleton className="h-32" />
          <DashSkeleton className="h-32" />
          <DashSkeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="dash-kit space-y-5" data-dashboard-home={role}>
      <header className="dh-hero dh-in">
        <div className="dh-hero__sky" aria-hidden="true"><Scene scene="sky" /></div>
        <div className="min-w-0">
          <p className="dh-eyebrow">{greetingFor(hour)}</p>
          <h1 className="dh-name">{name}</h1>
          <p className="dh-blurb">{home.blurb}</p>
          {children.length > 0 ? (
            <div className="dh-children" role="tablist" aria-label="Your children">
              {children.map(child => {
                const active = child.id === selected?.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setChildId(child.id)}
                    className="dh-child"
                  >
                    {child.name}
                    <span>{child.level}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {/* The first three things to do, once. They used to appear as pills here and again as tiles below. */}
        <nav className="dh-actions" aria-label="Start here">
          <p className="dh-actions__title">Start here</p>
          {home.tasks.map(task => (
            <Link key={task.id} href={task.href} className="dh-action">
              <span className="dh-action__icon" style={{ background: CATEGORY_STYLE[task.category].wash, color: CATEGORY_STYLE[task.category].ink }}>
                <CategoryIcon category={task.category} className="h-5 w-5" />
              </span>
              <span className="dh-action__text">
                <span className="dh-action__label">{task.label}</span>
                {task.hint ? <span className="dh-action__hint">{task.hint}</span> : null}
              </span>
              <span className="dh-action__go" aria-hidden><ArrowRight className="h-4 w-4" /></span>
            </Link>
          ))}
        </nav>
      </header>

      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
        {stats.map(stat => (
          <StatCard key={stat.id} label={stat.label} value={stat.value} hint={stat.hint} series={stat.series} ring={stat.ring} />
        ))}
      </section>

      {alerts.map(alert => <AlertCard key={alert.id} tone={alert.tone} title={alert.title} detail={alert.detail} />)}

      <section aria-label="More">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="dh-section-title text-foreground">More</h2>
          {onArrange ? (
            <button
              type="button"
              onClick={() => onArrange(!arranging)}
              className="inline-flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold"
            >
              {arranging ? 'Done' : 'Arrange'}
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile, index) => (
            <TileLink key={tile.id} href={tile.href} label={tile.label} hint={tile.hint ?? CATEGORY_STYLE[tile.category].label} category={tile.category} icon={tile.id === 'notes' ? 'sticky-note' : undefined}>
              {arranging && onTileOrder ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-card text-xs font-semibold"
                    onClick={event => {
                      event.preventDefault();
                      onTileOrder(moveTile(tiles.map(item => item.id), tile.id, -1));
                    }}
                    disabled={index === 0}
                  >
                    Earlier
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-card text-xs font-semibold"
                    onClick={event => {
                      event.preventDefault();
                      onTileOrder(moveTile(tiles.map(item => item.id), tile.id, 1));
                    }}
                    disabled={index === tiles.length - 1}
                  >
                    Later
                  </button>
                </span>
              ) : null}
            </TileLink>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListCard title={listTitle} rows={rows} />
        <div className="space-y-3">
          {showMap ? <InsightMap /> : null}
          {badges.length > 0 ? (
            <section className="ps-surface p-4">
              <h2 className="font-heading text-xl">Recognition</h2>
              <p className="mt-1 text-sm text-muted-foreground">Shown to you, and to your school when you have earned it. Never used to rank people.</p>
              <div className="mt-3 grid gap-2">
                {badges.map(badge => <BadgeArt key={badge.id} label={badge.label} earned={badge.earned} />)}
              </div>
            </section>
          ) : null}
          {selected ? (
            <p className="rounded-[18px] bg-card px-4 py-3 text-sm text-muted-foreground">
              Showing {selected.name} · {selected.level}. Switch a child any time from the header.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
