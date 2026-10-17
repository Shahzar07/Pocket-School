'use client';

import { AdminDesk } from '@/components/admin/desk';
import { DashPage } from '@/components/dash-ui';

export default function AdminPulsePage() {
  return (
    <DashPage>
      <AdminDesk view="pulse" />
    </DashPage>
  );
}
