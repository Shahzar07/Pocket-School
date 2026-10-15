import type { Metadata } from 'next';
import { StudioView } from '@/components/reads/studio-view';

export const metadata: Metadata = { title: 'Book Studio · Poket Reads' };

export default function StudioPage() {
  return <StudioView />;
}
