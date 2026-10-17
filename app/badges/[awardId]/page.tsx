import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeArt } from '@/components/gamification/badge-art';
import { BadgeShareLinks } from '@/components/gamification/badge-share';
import { publicBadgeUrl } from '@/lib/gamification/share';
import { loadPublicBadge } from '@/lib/server/public-badge';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ awardId: string }>;
}): Promise<Metadata> {
  const { awardId } = await params;
  const badge = await loadPublicBadge(awardId);
  if (!badge) return { title: 'Badge', robots: { index: false, follow: false } };
  const url = publicBadgeUrl(awardId);
  const description = badge.description || `${badge.name} on Poket School`;
  return {
    title: `${badge.name} · Poket School`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: badge.name,
      description,
      siteName: 'Poket School',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: badge.name }],
    },
  };
}

export default async function PublicBadgePage({
  params,
}: {
  params: Promise<{ awardId: string }>;
}) {
  const { awardId } = await params;
  const badge = await loadPublicBadge(awardId);
  if (!badge) notFound();
  return (
    <main className="min-h-screen px-4 py-12" style={{ background: '#1A3C34' }}>
      <article className="mx-auto w-full max-w-sm rounded-3xl bg-[#14332c] p-6 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#C8922A' }}>Poket School</p>
        <div className="mt-4 flex justify-center">
          <BadgeArt icon={badge.icon} size={120} title={badge.name} />
        </div>
        <h1 className="font-heading text-3xl mt-4">{badge.name}</h1>
        <p className="text-sm mt-2 text-white/80">{badge.description}</p>
        <p className="mt-6 text-sm font-semibold">{badge.earner}{badge.school ? ` · ${badge.school}` : ''}</p>
        <p className="text-[11px] uppercase tracking-wider mt-1" style={{ color: '#C8922A' }}>{badge.tier}</p>
        <div className="mt-6">
          <BadgeShareLinks awardId={badge.awardId} name={badge.name} issuedAt={badge.awardedAt} />
        </div>
      </article>
    </main>
  );
}
