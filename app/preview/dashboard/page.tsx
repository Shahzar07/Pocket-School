'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/shell';
import { isDashRole } from '@/lib/dashboard/home';

function PreviewBody() {
  const params = useSearchParams();
  const raw = params.get('role') ?? 'student';
  const role = isDashRole(raw) ? raw : 'student';
  return <DashboardShell role={role} hour={9} />;
}

export default function DashboardPreviewPage() {
  return (
    <Suspense fallback={<div className="ps-skeleton min-h-screen" aria-hidden="true" />}>
      <PreviewBody />
    </Suspense>
  );
}
