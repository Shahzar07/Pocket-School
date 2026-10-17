import { DashHeader, DashPage } from '@/components/dash-ui';
import { AllStaffSample } from '@/components/alerts/all-staff';

export const dynamic = 'force-dynamic';

export default function PreviewAllStaff() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="All-staff alert"
        title="Staff are checking in"
        description="The banner shows the type, the place in school, and what to do. The child's name is not here."
      />
      <AllStaffSample />
    </DashPage>
  );
}
