import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: {
    absolute: 'Poket School — AI teachers, study tools, and the school desk',
  },
  description:
    'Poket School brings named AI teachers, AI Studio, goals, attendance, and report cards together on one login. Start on the free preview.',
};

export default function Page() {
  return <LandingPage />;
}
