'use client';

import { SafetyDesk } from '@/components/safety/desk';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function StudentSafetyPage() {
  const { profile } = useAuthSTORE();
  const country = profile?.country || 'Malaysia';
  return (
    <DashPage>
      <DashHeader
        eyebrow="Safeguarding"
        title="Report a safety concern"
        description="Tap the type that fits. You do not have to write anything else. If you are in danger now, call the emergency number on this page."
      />
      <SafetyDesk country={country} />
    </DashPage>
  );
}
