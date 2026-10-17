'use client';

import { ProgressScreen } from '@/components/progress/progress-screen';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function InstitutionProgressPage() {
  const { profile } = useAuthSTORE();
  return (
    <ProgressScreen
      scope="institution"
      mode="institution"
      eyebrow="School"
      title="At-risk learners"
      description="Levels with fewer than five learners stay off the overview. Named alerts stay visible to staff."
      settingsId={profile?.institutionId || undefined}
    />
  );
}
