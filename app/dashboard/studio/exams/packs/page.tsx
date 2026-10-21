import { Suspense } from 'react';
import { OfficialPacks } from '@/components/study/official-packs';

export default function OfficialExamsPage() {
  return (
    <Suspense>
      <OfficialPacks />
    </Suspense>
  );
}
