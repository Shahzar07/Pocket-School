'use client';

import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashboardHome } from '@/components/dashboard';

export default function AlumniHomePage() {
  const { profile } = useAuthSTORE();
  const name = profile?.displayName || profile?.name || 'Alumni';
  return (
    <div className="space-y-6">
      <DashboardHome
        role="alumni"
        name={name.split(' ')[0] || 'Alumni'}
        listTitle="Keep with you"
        rows={[
          { id: 'certs', title: 'Certificates', detail: 'Open the ones already issued to you' },
          { id: 'profile', title: 'Profile', detail: 'You choose what a school can see' },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        This desk reuses the shared home. Certificates and your profile stay where they already live.
        {' '}
        <Link href="/dashboard/student/certificates" className="font-semibold text-primary">Open certificates</Link>
      </p>
    </div>
  );
}
