import type { Metadata } from 'next';
import { SafetyTermsChildView } from '@/components/safety/disclaimer';
import { BRAND } from '@/lib/brand';
import {
  COMMUNITY_PARTNERS_LINE,
  FULL_CLAUSES,
  PENDING_LEGAL_REVIEW,
  SAFETY_TERMS_STATUS,
  SAFETY_TERMS_TITLE,
} from '@/lib/safety/disclaimer';

export const metadata: Metadata = {
  title: 'Community safety terms',
  description: SAFETY_TERMS_TITLE,
  alternates: { canonical: '/safety-terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Community safety terms',
    description: SAFETY_TERMS_STATUS,
    url: '/safety-terms',
  },
};

export default function SafetyTermsPage() {
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-12 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold">{SAFETY_TERMS_TITLE}</h1>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <p className="font-semibold" style={{ color: BRAND.blueDeep }}>{SAFETY_TERMS_STATUS}</p>
        <p style={{ color: BRAND.blueDeep }}>{PENDING_LEGAL_REVIEW}</p>
        <p style={{ color: BRAND.ink }}>{COMMUNITY_PARTNERS_LINE} <a href="/community-partners" style={{ color: BRAND.blueDeep }}>Get involved</a></p>
        <SafetyTermsChildView />
        <article id="safety-clauses" className="grid gap-4 rounded-3xl border bg-white p-5">
          {FULL_CLAUSES.map(clause => (
            <p key={clause.slice(0, 12)} style={{ color: BRAND.ink }}>{clause}</p>
          ))}
        </article>
      </div>
    </main>
  );
}
