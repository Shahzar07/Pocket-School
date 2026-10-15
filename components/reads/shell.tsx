'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useReadsT } from '@/lib/reads/i18n';
import { ProfileSwitch, useShelfProfile } from '@/components/shelf/profile-bar';

const LINKS = [
  { href: '/reads', key: 'reads.nav.home' as const },
  { href: '/reads/library', key: 'reads.nav.library' as const },
  { href: '/reads/leaderboard', key: 'reads.nav.board' as const },
  { href: '/reads/studio', key: 'reads.nav.studio' as const },
  { href: '/courses', key: 'reads.nav.courses' as const },
];

export function ReadsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useReadsT();
  const { profile, choose } = useShelfProfile();
  const reading = pathname.startsWith('/reads/read/');
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
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${active ? 'bg-[#203337] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
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
