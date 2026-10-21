'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { crumbLabel, useCrumbVersion } from '@/lib/shell/crumb-titles';

const LABELS: Record<string, string> = {
  dashboard: 'Home',
  student: 'Learning',
  teacher: 'Teaching',
  parent: 'Family',
  admin: 'Admin',
  institution: 'School',
  studio: 'ET AI Studio',
  goals: 'Goals',
  analytics: 'Insights',
  reports: 'Reports',
  behaviour: 'Behaviour',
  calendar: 'Calendar',
  messages: 'Messages',
  profile: 'Profile and settings',
  courses: 'Courses',
  curriculum: 'Course builder',
  users: 'People',
  integrity: 'Integrity',
  attendance: 'Attendance',
  assignments: 'Assignments',
  exams: 'Exams',
  billing: 'Billing',
  wallet: 'Wallet',
  reads: 'Books',
  templates: 'Report cards',
  settings: 'Settings',
  helpdesk: 'Help',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  useCrumbVersion();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  const crumbs = parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join('/')}`;
    const named = crumbLabel(part);
    const label = named ?? LABELS[part] ?? part.replace(/-/g, ' ');
    return { href, label, current: index === parts.length - 1, named: Boolean(named) };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-x-auto text-[12px] text-muted-foreground">
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="inline-flex items-center gap-1 shrink-0">
          {index > 0 && <span aria-hidden="true">/</span>}
          {crumb.current ? (
            <span aria-current="page" className={`font-semibold text-foreground ${crumb.named ? '' : 'capitalize'}`}>{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className={`${crumb.named ? '' : 'capitalize'} hover:text-foreground`}>{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
