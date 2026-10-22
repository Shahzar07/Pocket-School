import type { Metadata } from 'next';
import { ReadsHome } from '@/components/reads/home-view';
import { PublicFlow } from '@/components/school-desk/route-desk';

export const metadata: Metadata = { title: 'Poket Reads' };

export default function ReadsPage() {
  return (
    <>
      <PublicFlow flow="read" />
      <ReadsHome />
    </>
  );
}
