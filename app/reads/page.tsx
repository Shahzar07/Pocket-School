import type { Metadata } from 'next';
import { ReadsHome } from '@/components/reads/home-view';

export const metadata: Metadata = { title: 'Poket Reads' };

export default function ReadsPage() {
  return <ReadsHome />;
}
