import type { Metadata } from 'next';
import { PartnersForm } from '@/components/community/partners-form';
import { BRAND } from '@/lib/brand';
import { PARTNER_TYPES } from '@/lib/community/partners';
import { COMMUNITY_PARTNERS_LINE } from '@/lib/safety/disclaimer';

export const metadata: Metadata = {
  title: 'Community partners',
  description: COMMUNITY_PARTNERS_LINE,
  alternates: { canonical: '/community-partners' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Community partners',
    description: COMMUNITY_PARTNERS_LINE,
    url: '/community-partners',
  },
};

const notes: Record<string, string> = {
  police: 'Police can ask to become a verified tier-4 partner. An admin checks the organisation before anything is shared.',
  child_protection: 'A child-protection NGO can ask to become a verified tier-4 partner. Applying does not open a case.',
  school: 'Schools can join free. Approval points a school to institution onboarding. It does not create the school.',
  counsellor: 'Counsellors and mental-health organisations can ask to be listed. A person reviews the request.',
  helpline: 'A helpline can ask to be listed. We do not invent a number.',
  business: 'A business or sponsor can fund the Safety Desk or offer student perks through the partner merchant flow. Approval does not open a shop.',
  volunteer: 'Volunteers can ask to help. A person replies. An application is not a role.',
  media: 'Media can ask for a briefing. A person replies. An application is not a quote.',
};

export default function CommunityPartnersPage() {
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-12 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold">Community partners</h1>
        <p className="mt-3 max-w-2xl text-lg">{COMMUNITY_PARTNERS_LINE}</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Who can get involved</h2>
          <ul className="mt-3 grid gap-3">
            {PARTNER_TYPES.map(item => (
              <li key={item.id} style={{ color: BRAND.ink }}>
                <p className="font-semibold" style={{ color: BRAND.blueDeep }}>{item.label}</p>
                <p>{notes[item.id]}</p>
              </li>
            ))}
          </ul>
        </article>
        <PartnersForm />
      </div>
    </main>
  );
}
