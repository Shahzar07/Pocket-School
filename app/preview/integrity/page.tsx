'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { IntegrityStudio, type DeskSide } from '@/components/insights/integrity-studio';

function Preview() {
  const params = useSearchParams();
  const side = params.get('side');
  const role: DeskSide = side === 'parent' || side === 'teacher' || side === 'institution' ? side : 'student';
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <IntegrityStudio side={role} />
    </main>
  );
}

export default function IntegrityPreviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading the desk…</p>}>
      <Preview />
    </Suspense>
  );
}
