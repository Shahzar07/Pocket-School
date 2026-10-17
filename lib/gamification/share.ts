export const BADGE_ORIGIN = 'https://poketschool.ai';

export function publicBadgePath(awardId: string): string {
  return `/badges/${encodeURIComponent(awardId)}`;
}

export function publicBadgeUrl(awardId: string, origin = BADGE_ORIGIN): string {
  const root = origin.replace(/\/$/, '');
  return `${root}${publicBadgePath(awardId)}`;
}

/** LinkedIn share-offsite. The shared URL is the public badge page. */
export function linkedInShareOffsite(pageUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
}

/**
 * LinkedIn Add to Profile. certUrl is the public badge page, so the
 * certification works without a signed Open Badge.
 */
export function linkedInAddToProfile(input: {
  name: string;
  awardId: string;
  pageUrl: string;
  issuedAt?: string | null;
}): string {
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: input.name.slice(0, 80),
    organizationName: 'Poket School',
    certUrl: input.pageUrl,
    certId: input.awardId,
  });
  if (input.issuedAt) {
    const issued = new Date(input.issuedAt);
    if (!Number.isNaN(issued.getTime())) {
      params.set('issueYear', String(issued.getUTCFullYear()));
      params.set('issueMonth', String(issued.getUTCMonth() + 1));
    }
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
