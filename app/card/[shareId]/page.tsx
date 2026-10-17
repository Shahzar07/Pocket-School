import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { loadPublicCard, recordCardView } from '@/lib/cards/server';
import { MemberCardFace } from '@/components/cards/member-card-face';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const { shareId } = await params;
  if (!isAdminConfigured()) return { title: 'Poket School', robots: { index: false, follow: false } };
  const card = await loadPublicCard(shareId).catch(() => null);
  if (!card) return { title: 'Poket School', robots: { index: false, follow: false } };
  return {
    title: `${card.firstName} · ${card.title}`,
    description: card.levelName
      ? `${card.firstName} is on Poket School, ${card.levelName}.`
      : `${card.firstName} is a Poket School member.`,
    robots: card.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function CardSharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  if (!isAdminConfigured()) notFound();
  const card = await loadPublicCard(shareId).catch(() => null);
  if (!card) notFound();
  await recordCardView(shareId).catch(() => undefined);

  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12 text-[#203337]">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <MemberCardFace card={card} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-sm text-[#203337]">Join Poket School and start with a free member card of your own.</p>
          <Link
            href={card.joinPath}
            className="inline-flex items-center rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 py-3 text-sm font-semibold text-[#203337]"
          >
            Join Poket School
          </Link>
        </div>
      </div>
    </main>
  );
}
