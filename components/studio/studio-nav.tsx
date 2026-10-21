'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isAiToolPath } from '@/lib/studio/tool-inventory';
import { STUDIO_TIMETABLE } from '@/lib/studio-paths';
import { studioTimetableGate } from '@/lib/timetable/access';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';

const LINKS = [
  { href: '/dashboard/studio', label: 'AI Studio' },
  { href: '/dashboard/studio/et', label: 'ET AI' },
  { href: '/dashboard/studio/teachers', label: 'AI Teachers' },
  { href: '/dashboard/studio/maths', label: 'ET Maths' },
  { href: '/dashboard/studio/exam-prep', label: 'ET Exams' },
  { href: '/dashboard/studio/essays', label: 'ET Essays' },
  { href: '/dashboard/store', label: 'Creator Store' },
  { href: '/dashboard/admin/books', label: 'AI Book Creator' },
] as const;

/** Horizontal section links. This is not a second sidebar. */
export function StudioNav() {
  const pathname = usePathname() ?? '';
  const profile = useAuthSTORE(state => state.profile);
  const showTimetable = studioTimetableGate({
    role: profile?.role,
    roles: profile?.roles,
    permissions: profile?.permissions,
  }) !== 'hidden';
  const links = showTimetable
    ? [...LINKS, { href: STUDIO_TIMETABLE, label: TIMETABLE_COPY.studioTab }]
    : [...LINKS];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-3 py-2" aria-label="AI Studio" data-studio-nav="header">
      {links.map((link) => {
        const active = link.href === '/dashboard/studio'
          ? pathname === '/dashboard/studio'
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold ${active ? 'bg-[#3FE0D0] text-[#203337]' : 'text-[#1E6A83] hover:bg-muted'}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudioFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  /* Tool routes use the full-page shell. This frame must not add a second nav. */
  if (isAiToolPath(pathname)) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-clip bg-transparent" data-studio-shell={pathname === '/dashboard/studio' || pathname === '/dashboard/studio/et' ? 'chat' : 'tool'}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-col bg-background" data-studio-shell="standalone">
      <StudioNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
