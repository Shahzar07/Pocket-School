'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DesignDesk } from '@/components/shell/design-desk';
import type { ShellRole } from '@/components/shell/mobile-nav';

const ROLES: ShellRole[] = ['student', 'teacher', 'parent', 'admin', 'institution_admin'];

function Desk() {
  const params = useSearchParams();
  const requested = params.get('role') ?? 'student';
  const role = ROLES.includes(requested as ShellRole) ? requested as ShellRole : 'student';
  return <DesignDesk role={role} />;
}

export default function DesignPreviewPage() {
  return (
    <Suspense fallback={<div className="ps-skeleton min-h-screen" aria-hidden="true" />}>
      <Desk />
    </Suspense>
  );
}
