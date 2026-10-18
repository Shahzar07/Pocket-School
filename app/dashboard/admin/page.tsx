'use client';

import { AdminDesk } from '@/components/admin/desk';
import { DashPage } from '@/components/dash-ui';

export default function AdminDashboard() {
  return (
    <DashPage>
      <AdminDesk view="home" />
    </DashPage>
  );
}
