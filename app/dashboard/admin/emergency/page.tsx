'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { WidenAllStaff } from '@/components/alerts/all-staff';
import { EmergencyLive } from '@/components/hotline/live';

function EmergencyDesk() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <div className="grid gap-4">
      <EmergencyLive />
      {id ? <WidenAllStaff source="emergency" sourceId={id} /> : null}
    </div>
  );
}

export default function AdminEmergencyPage() {
  return (
    <Suspense fallback={null}>
      <EmergencyDesk />
    </Suspense>
  );
}
