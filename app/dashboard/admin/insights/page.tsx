'use client';

import { ProgressScreen } from '@/components/progress/progress-screen';

export default function AdminInsightsPage() {
  return (
    <ProgressScreen
      scope="platform"
      mode="admin"
      eyebrow="Insights"
      title="Progress alerts"
      description="Platform view of learning-progress alerts. Levels with fewer than five learners stay off the aggregate."
      settingsId="platform"
    />
  );
}
