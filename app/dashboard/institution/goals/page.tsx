'use client';

import { ClassAdherence } from '@/components/goals/class-adherence';
import { DashHeader, DashPage } from '@/components/dash-ui';

export default function InstitutionGoalsPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="School"
        title="Class goal adherence"
        description="Counts of assigned goals only. Private goals and note text are not included."
      />
      <ClassAdherence classRate={0} rows={[]} />
    </DashPage>
  );
}
