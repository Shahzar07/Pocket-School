'use client';

import { AdminDesk } from '@/components/admin/desk';
import { DashPage } from '@/components/dash-ui';

export default function AdminPlatformPage() {
  return (
    <DashPage>
      <AdminDesk view="platform" />
    </DashPage>
  );
}
