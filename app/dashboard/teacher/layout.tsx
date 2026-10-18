'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AssignmentsDesk } from '@/components/school-desk/assignments';
import { ClassDesk } from '@/components/school-desk/classes';
import { GoalsDesk } from '@/components/school-desk/goals';
import { GradebookDesk } from '@/components/school-desk/gradebook';
import { ReportCardDesk } from '@/components/school-desk/reports';
import { DeskProvider } from '@/components/school-desk/ui';

/**
 * Class tools sit on the existing teacher pages. Attendance, Report Studio,
 * and earnings stay the live course pages and are not wrapped.
 */
export default function TeacherToolsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <DeskProvider>
      {pathname === '/dashboard/teacher/classes' ? <ClassDesk /> : null}
      {pathname === '/dashboard/teacher/assignments' ? <AssignmentsDesk /> : null}
      {pathname === '/dashboard/teacher/gradebook' ? <GradebookDesk /> : null}
      {pathname === '/dashboard/teacher/report-cards' ? <ReportCardDesk /> : null}
      {pathname === '/dashboard/teacher/goals' ? <GoalsDesk /> : null}
      {children}
    </DeskProvider>
  );
}
