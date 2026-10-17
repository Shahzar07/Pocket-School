import type { Metadata } from 'next';
import { StandUp } from '@/components/bullying/stand-up';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ensureStandReferral } from '@/lib/server/bullying';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Stand up to bullying',
  description: 'Free anti-bullying help on Poket School, including if you have no school.',
  alternates: { canonical: '/stand-up-to-bullying' },
  openGraph: {
    title: 'Stand up to bullying',
    description: 'Free anti-bullying help on Poket School, including if you have no school.',
    url: '/stand-up-to-bullying',
  },
  robots: { index: true, follow: true },
};

export default async function StandUpPage() {
  if (isAdminConfigured()) {
    try {
      await ensureStandReferral();
    } catch (error) {
      console.error('stand referral', error);
    }
  }
  return <StandUp />;
}
