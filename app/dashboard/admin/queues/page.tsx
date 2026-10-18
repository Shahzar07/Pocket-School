'use client';

import { AdminDesk } from '@/components/admin/desk';
import { DashPage } from '@/components/dash-ui';

export default function AdminQueuesPage() {
  return (
    <DashPage>
      <AdminDesk view="queues" />
    </DashPage>
  );
}
