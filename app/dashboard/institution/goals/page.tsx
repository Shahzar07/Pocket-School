'use client';

import { ClassAdherence } from '@/components/goals/class-adherence';
import { DashHeader, DashPage } from '@/components/dash-ui';

export default function InstitutionGoalsPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="School"
        title="Class goal adherence"
        description="Every goal for learners at this school. A private note does not hide the goal."
      />
      <ClassAdherence classRate={0} rows={[]} />
    </DashPage>
  );
}
