'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Menu, Plus, Search, StickyNote, UserRound } from 'lucide-react';
import {
  CATEGORY_STYLE,
  groupNotices,
  roleHome,
  searchLinks,
  sidebarGroups,
  type DashRole,
} from '@/lib/dashboard/home';
import { previewHome } from '@/lib/dashboard/preview';
import { CategoryIcon } from './icons';
import { HomeView } from './home-view';
import { CloseControl, useLayerDismiss } from '@/components/ui/close-control';

export function DashboardShell({ role, hour = 9 }: { role: DashRole; hour?: number }) {
  const home = roleHome(role);
  const preview = previewHome(role);
  const groups = sidebarGroups(role);
  const notices = groupNotices(preview.notices);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [order, setOrder] = useState<string[] | undefined>(undefined);
  const [coach, setCoach] = useState(role === 'student');
  useLayerDismiss(searchOpen, () => setSearchOpen(false));
  useLayerDismiss(bellOpen, () => setBellOpen(false));
  useLayerDismiss(profileOpen, () => setProfileOpen(false));
  const [arranging, setArranging] = useState(false);
  const hits = searchLinks(role, query);

  return (
    <div className="min-h-screen bg-background text-foreground" data-dash-shell={role}>
      <div className="flex min-h-screen">
        <aside className={`hidden shrink-0 border-e border-sidebar-border bg-sidebar lg:flex lg:flex-col ${collapsed ? 'w-[76px]' : 'w-[248px]'}`}>
          <div className="flex items-center gap-3 px-3 py-4">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] text-sm font-bold"
              style={{
                background: 'var(--ps-tile-wash)',
                color: 'var(--ps-tile-ink)',
              }}
            >
              {preview.name.slice(0, 1)}
            </span>
            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{preview.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{home.label}</span>
              </span>
            )}
          </div>
          <nav aria-label="Sections" className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
            {groups.map(group => (
              <div key={group.category}>
                {collapsed ? null : (
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {CATEGORY_STYLE[group.category].label}
                  </p>
                )}
                {group.items.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={item.label}
                    className="flex min-h-12 items-center gap-3 rounded-[18px] px-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <span style={{ color: CATEGORY_STYLE[item.category].ink }}><CategoryIcon category={item.category} /></span>
                    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[72px] items-center justify-between gap-3 border-b border-border bg-background/90 px-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hidden h-12 w-12 place-items-center rounded-[18px] hover:bg-muted lg:grid"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed(value => !value)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground"
                onClick={() => { setSearchOpen(true); setBellOpen(false); setProfileOpen(false); }}
              >
                <Search className="h-5 w-5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded-md border border-border px-1.5 text-[11px] sm:inline">⌘K</kbd>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="relative grid h-12 w-12 place-items-center rounded-[18px] hover:bg-muted"
                aria-label="Notifications"
                aria-expanded={bellOpen}
                onClick={() => { setBellOpen(value => !value); setSearchOpen(false); setProfileOpen(false); }}
              >
                <Bell className="h-6 w-6" />
                <span className="absolute end-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {preview.notices.length}
                </span>
              </button>
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full border border-border"
                aria-label="Profile"
                aria-expanded={profileOpen}
                onClick={() => { setProfileOpen(value => !value); setBellOpen(false); setSearchOpen(false); }}
              >
                <UserRound className="h-6 w-6" />
              </button>
            </div>
          </header>

          {searchOpen ? (
            <div className="relative border-b border-border bg-card px-4 py-3 pe-16" role="dialog" aria-label="Search">
              <CloseControl onClose={() => setSearchOpen(false)} className="absolute top-2 right-2" />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search this home"
                aria-label="Search this home"
                className="h-12 w-full rounded-[18px] border border-border bg-background px-4 text-sm"
              />
              <ul className="mt-2">
                {hits.map(hit => (
                  <li key={hit.id}>
                    <Link href={hit.href} className="flex min-h-12 items-center gap-3 rounded-[18px] px-2 text-sm hover:bg-muted">
                      <CategoryIcon category={hit.category} />
                      <span className="font-semibold">{hit.label}</span>
                      <span className="text-muted-foreground">{CATEGORY_STYLE[hit.category].label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {bellOpen ? (
            <div className="relative border-b border-border bg-card px-4 py-3 pe-16" role="dialog" aria-label="Notifications">
              <CloseControl onClose={() => setBellOpen(false)} className="absolute top-2 right-2" />
              {notices.map(group => (
                <section key={group.category} className="mb-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</h2>
                  <ul>
                    {group.items.map(item => (
                      <li key={item.id} className="flex min-h-12 items-center text-sm">{item.title}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}

          {profileOpen ? (
            <div className="relative border-b border-border bg-card px-4 py-3 pe-16 text-sm" role="menu">
              <CloseControl onClose={() => setProfileOpen(false)} className="absolute top-2 right-2" />
              <p className="font-semibold">{preview.name}</p>
              <p className="text-muted-foreground">{home.label}</p>
              <Link href="/dashboard/profile" className="mt-2 inline-flex min-h-12 items-center font-semibold text-primary">Settings</Link>
            </div>
          ) : null}

          <main id="dashboard-main" className="flex-1 px-4 py-5 pb-28 lg:px-6 lg:pb-10">
            <HomeView
              role={role}
              name={preview.name}
              hour={hour}
              stats={preview.stats}
              alerts={preview.alerts}
              rows={preview.rows}
              listTitle={preview.listTitle}
              children={preview.children}
              badges={preview.badges}
              showMap={preview.showMap}
              tileOrder={order}
              onTileOrder={setOrder}
              showCoach={coach}
              onDismissCoach={() => setCoach(false)}
              arranging={arranging}
              onArrange={setArranging}
            />
          </main>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5">
          {home.tabs.map(tab => (
            <li key={tab.id}>
              <Link href={tab.href} className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground">
                <CategoryIcon category={tab.category} className="h-6 w-6" />
                {tab.label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMoreOpen(value => !value)} className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold">
              <Menu className="h-6 w-6" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Link
        href={home.fab.href}
        className="fixed end-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] lg:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="h-6 w-6" />
        {home.fab.label}
      </Link>

      {moreOpen ? (
        <div className="fixed inset-x-0 bottom-16 z-30 max-h-[50vh] overflow-y-auto rounded-t-[24px] border border-border bg-card p-4 shadow-[var(--shadow-card)] lg:hidden">
          <p className="mb-2 text-sm font-semibold">More</p>
          <ul>
            {home.tiles.map(tile => (
              <li key={tile.id}>
                <Link href={tile.href} className="flex min-h-12 items-center gap-3 text-sm font-medium">
                  {tile.id === 'notes' ? <StickyNote className="h-6 w-6" strokeWidth={1.75} aria-hidden /> : <CategoryIcon category={tile.category} />}
                  {tile.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
