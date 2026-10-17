'use client';

import Link from 'next/link';
import { Menu, Plus } from 'lucide-react';
import { roleHome, type DashRole } from '@/lib/dashboard/home';
import { CategoryIcon } from '@/components/dashboard/icons';

export type ShellRole = 'student' | 'teacher' | 'parent' | 'admin' | 'institution_admin' | 'partner_merchant';

function dashRole(role: Exclude<ShellRole, 'partner_merchant'>): DashRole {
  if (role === 'institution_admin') return 'institution';
  return role;
}

export function MobileNav({ role, onMore }: { role: ShellRole; onMore: () => void }) {
  if (role === 'partner_merchant') {
    return (
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5">
          <li>
            <Link href="/dashboard/partner" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground">
              <CategoryIcon category="payments" className="h-6 w-6" />
              Portal
            </Link>
          </li>
          <li>
            <Link href="/dashboard/card" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground">
              <CategoryIcon category="settings" className="h-6 w-6" />
              Card
            </Link>
          </li>
          <li>
            <Link href="/partner" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground">
              <CategoryIcon category="people" className="h-6 w-6" />
              Setup
            </Link>
          </li>
          <li>
            <Link href="/dashboard/profile" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground">
              <CategoryIcon category="settings" className="h-6 w-6" />
              Profile
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={onMore}
              className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>
    );
  }
  const home = roleHome(dashRole(role));
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {home.tabs.map(tab => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground"
            >
              <CategoryIcon category={tab.category} className="h-6 w-6" />
              {tab.label}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-foreground"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function DashFab({ role }: { role: ShellRole }) {
  const home = role === 'partner_merchant'
    ? { fab: { href: '/dashboard/partner', label: 'Offers' } }
    : roleHome(dashRole(role));
  return (
    <Link
      href={home.fab.href}
      className="fixed end-4 z-40 inline-flex h-14 min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] lg:hidden"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
      {home.fab.label}
    </Link>
  );
}
