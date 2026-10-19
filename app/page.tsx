import type { Metadata } from 'next';
import { SiteHome } from '@/components/site-home';

export const metadata: Metadata = {
  title: {
    absolute: 'Poket School — Learn your way. Go further with AI.',
  },
  description:
    'Poket School brings named AI teachers, AI Studio, goals, attendance, and report cards together on one login. Start on the free preview.',
};

export default function Page() {
  return <SiteHome />;
}
