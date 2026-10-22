'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useReadsT } from '@/lib/reads/i18n';
import { ProfileSwitch, useShelfProfile } from '@/components/shelf/profile-bar';
import { ACCOUNT_MODES, readAccountMode, writeAccountMode, type AccountMode } from '@/lib/platform/roles';
import type { ReadsKey } from '@/lib/reads/messages';

const MODE_KEYS: Record<AccountMode, ReadsKey> = {
  student: 'reads.mode.student',
  parent: 'reads.mode.parent',
  teacher: 'reads.mode.teacher',
  admin: 'reads.mode.admin',
};

const LINKS = [
  { href: '/reads', key: 'reads.nav.home' as const },
  { href: '/reads/offer', key: 'reads.nav.subscribe' as const },
  { href: '/reads/library', key: 'reads.nav.library' as const },
  { href: '/reads/leaderboard', key: 'reads.nav.board' as const },
  { href: '/reads/studio', key: 'reads.nav.studio' as const },
  { href: '/courses', key: 'reads.nav.courses' as const },
];

export function ReadsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useReadsT();
  const { profile, choose } = useShelfProfile();
  const [mode, setMode] = useState<AccountMode>('student');
  const reading = pathname.startsWith('/reads/read/');

  useEffect(() => { setMode(readAccountMode()); }, []);
  if (reading) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
          <Link href="/reads" className="font-heading text-[22px] tracking-[-0.04em] text-foreground">
            {t('reads.brand')}
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label={t('reads.brand')}>
            {LINKS.map(link => {
              const active = link.href === '/reads' ? pathname === '/reads' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="hidden items-center gap-2 text-[12px] font-semibold text-muted-foreground sm:flex">
              {t('reads.mode.label')}
              <select
                aria-label={t('reads.mode.label')}
                value={mode}
                onChange={event => {
                  const next = event.target.value as AccountMode;
                  setMode(next);
                  writeAccountMode(next);
                }}
                className="h-9 rounded-full border border-border bg-background px-3 text-[13px] font-semibold text-foreground"
              >
                {ACCOUNT_MODES.map(item => (
                  <option key={item} value={item}>{t(MODE_KEYS[item])}</option>
                ))}
              </select>
            </label>
            <ProfileSwitch profile={profile} onChoose={choose} label={t('reads.profile.switch')} />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden [scrollbar-width:none]">
          {LINKS.map(link => (
            <Link key={link.href} href={link.href} className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold">
              {t(link.key)}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
