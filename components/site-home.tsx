'use client';

import { useMemo } from 'react';
import { AcademyWelcome } from '@/components/academy-welcome';
import { useWhiteLabel } from '@/components/white-label-provider';
import { HomeV3 } from '@/components/landing/home-v3';
import { signupDecision } from '@/lib/academy-settings';
import { institutionOrigin } from '@/lib/white-label';

/** Platform marketing, or the academy home when the host is a tenant. */
export function SiteHome() {
  const { branding, institution, hrefFor } = useWhiteLabel();
  const signupNote = useMemo(() => {
    if (!institution) return '';
    const decision = signupDecision({ policy: institution.signupPolicy, domains: institution.allowedEmailDomains, email: '' });
    if (institution.signupPolicy === 'domain') return 'New accounts need an email on an allowed academy domain.';
    return decision.ok ? '' : decision.reason;
  }, [institution]);

  if (!institution || !branding.isWhiteLabel) return <HomeV3 />;

  const slug = institution.subdomain;
  const address = institution.customDomain
    ? institution.customDomain
    : slug
      ? `${institutionOrigin(slug)} · /a/${slug}`
      : 'Poket School academy';
  return (
    <AcademyWelcome
      branding={branding}
      catalogueTitles={institution.catalogueVisibility === 'private' ? [] : (institution.publicCatalogueIds ?? [])}
      pages={(institution.publishedPages ?? []).map((page) => ({ slug: page.slug, title: page.title }))}
      leaderboard={institution.features?.leaderboard ? (institution.leaderboard ?? []) : []}
      signupNote={signupNote}
      loginHref={hrefFor('/login')}
      coursesHref={hrefFor('/courses')}
      leaderboardHref={hrefFor('/academy/leaderboard')}
      pageHref={(pageSlug) => hrefFor(`/academy/page/${pageSlug}`)}
      address={address}
    />
  );
}
