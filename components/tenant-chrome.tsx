'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AcademyLockup } from '@/components/academy-lockup';
import { useWhiteLabel } from '@/components/white-label-provider';
import { isBrandedLoginPath } from '@/lib/institution-login';
import { isInstitutionJourneyPath } from '@/lib/institution-journey';

/** A slim academy bar on public pages. The dashboard keeps its own shell. */
export function TenantChrome() {
  const pathname = usePathname() || '/';
  const { branding, institution, hrefFor } = useWhiteLabel();
  if (!institution || !branding.isWhiteLabel) return null;
  if (isBrandedLoginPath(pathname) || isInstitutionJourneyPath(pathname)) return null;
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) return null;
  if (pathname === '/') return null;
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <Link href={hrefFor('/')}>
          <AcademyLockup name={branding.displayName} logoUrl={branding.logoUrl} accent={branding.primaryColor} tone="light" />
        </Link>
        <Link href={hrefFor('/courses')} className="text-muted-foreground">Catalogue</Link>
        <Link href={hrefFor('/login')} className="text-muted-foreground">Sign in</Link>
        {institution.features?.leaderboard && institution.leaderboardVisible !== 'off' && (
          <Link href={hrefFor('/academy/leaderboard')} className="text-muted-foreground">Leaderboard</Link>
        )}
        {(institution.publishedPages ?? []).slice(0, 4).map((page) => (
          <Link key={page.slug} href={hrefFor(`/academy/page/${page.slug}`)} className="text-muted-foreground">{page.title}</Link>
        ))}
        {institution.status === 'suspended' && <span className="text-xs font-semibold">This academy is suspended.</span>}
        {!branding.hidePoweredBy && <span className="ms-auto text-xs text-muted-foreground">Powered by Poket School</span>}
      </div>
    </div>
  );
}
