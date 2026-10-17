'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { WidenAllStaff } from '@/components/alerts/all-staff';
import { EmergencyLive } from '@/components/hotline/live';

function InstitutionEmergencyDesk() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <div className="grid gap-4">
      <EmergencyLive />
      {id ? <WidenAllStaff source="emergency" sourceId={id} /> : null}
    </div>
  );
}

export default function InstitutionEmergencyPage() {
  return (
    <Suspense fallback={null}>
      <InstitutionEmergencyDesk />
    </Suspense>
  );
}
