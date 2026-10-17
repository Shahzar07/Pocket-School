import { linkedInAddToProfile, linkedInShareOffsite, publicBadgeUrl } from '@/lib/gamification/share';

export function BadgeShareLinks({
  awardId,
  name,
  issuedAt,
}: {
  awardId: string;
  name: string;
  issuedAt?: string | null;
}) {
  const page = publicBadgeUrl(awardId);
  return (
    <p className="flex flex-wrap gap-3 text-sm font-semibold">
      <a className="underline" href={linkedInShareOffsite(page)} target="_blank" rel="noreferrer">Share on LinkedIn</a>
      <a className="underline" href={linkedInAddToProfile({ name, awardId, pageUrl: page, issuedAt })} target="_blank" rel="noreferrer">Add to Profile</a>
    </p>
  );
}
