import { Suspense } from 'react';
import { OfficialFlow } from '@/components/study/official-flow-view';

export default function Page() {
  return (
    <Suspense>
      <OfficialFlow step="readiness" />
    </Suspense>
  );
}
