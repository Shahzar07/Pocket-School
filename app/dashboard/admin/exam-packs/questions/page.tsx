import { Suspense } from 'react';
import { PackDesk } from '@/components/study/pack-desk';

export default function Page() {
  return (
    <Suspense>
      <PackDesk step="questions" />
    </Suspense>
  );
}
