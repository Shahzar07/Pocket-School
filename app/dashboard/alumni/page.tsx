'use client';

import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashboardHome } from '@/components/dashboard';
import { WallScreen } from '@/components/wall/wall-screen';
import { RochfordAlumniDesk } from '@/components/alumni/rochford-desk';

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
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/alumni" className="inline-flex h-11 items-center rounded-full border border-[#096ab7] bg-[#d9efff] px-4 text-sm font-semibold text-[#11131b]">Join</Link>
        <a href="#alumni-wall" className="inline-flex h-11 items-center rounded-full border border-[#e5ebf2] bg-white px-4 text-sm font-semibold text-[#096ab7]">Browse</a>
        <Link href="/dashboard/student/network" className="inline-flex h-11 items-center rounded-full border border-[#e5ebf2] bg-white px-4 text-sm font-semibold text-[#096ab7]">Request to join</Link>
      </div>
      <div id="alumni-wall">
        <WallScreen surface="alumni" />
      </div>
      <RochfordAlumniDesk />
      <p className="text-sm text-muted-foreground">
        This desk reuses the shared home. Certificates and your profile stay where they already live.
        {' '}
        <Link href="/dashboard/student/certificates" className="font-semibold text-primary">Open certificates</Link>
      </p>
    </div>
  );
}
