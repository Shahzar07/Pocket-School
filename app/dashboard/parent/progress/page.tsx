'use client';

import { ProgressScreen } from '@/components/progress/progress-screen';

export default function ParentProgressPage() {
  return (
    <ProgressScreen
      scope="child"
      mode="parent"
      eyebrow="Family"
      title="Child progress"
      description="Green means settled. Amber, coral, and red are the traffic lights for a low, medium, high, or critical progress alert."
    />
  );
}
