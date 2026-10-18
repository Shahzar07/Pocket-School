'use client';

import { useState, type ReactNode } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { flowCopy, flowForPath } from '@/lib/school-desk/flows';
import { FlowDesk } from './flow-desk';
import { DeskScope } from './scope';
import { deskStyles } from './ui';

export function RouteDesk({
  pathname,
  role,
  children,
}: {
  pathname: string;
  role: string;
  children: ReactNode;
}) {
  const flow = flowForPath(pathname);
  const desk = role === 'teacher' || role === 'institution_admin' || (role === 'admin' && pathname === '/dashboard/admin/schools');
  const [legacy, setLegacy] = useState(false);
  if (!flow || !desk) {
    return (
      <>
        {role === 'teacher' || role === 'institution_admin' ? <DeskScope pathname={pathname} /> : null}
        {children}
      </>
    );
  }
  return (
    <>
      <FlowDesk flow={flow.id} />
      {flow.mode === 'prepend' || legacy ? children : null}
      {flow.mode === 'replace' ? (
        <button type="button" className={`${deskStyles.ghost} mt-4`} onClick={() => setLegacy((current) => !current)}>{flowCopy.legacy}</button>
      ) : null}
    </>
  );
}

export function PublicFlow({ flow }: { flow: 'marketplace' | 'read' }) {
  const profile = useAuthSTORE().profile;
  const role = profile?.role ?? '';
  if (role !== 'teacher' && role !== 'institution_admin') return null;
  return <FlowDesk flow={flow} />;
}
