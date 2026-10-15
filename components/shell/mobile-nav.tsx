'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookMarked, Calendar, ClipboardList, FileBarChart, Home, Layers, MessageSquare,
  MoreHorizontal, Presentation, Sparkles, Target, Users,
  type LucideIcon,
} from 'lucide-react';

export type ShellRole = 'student' | 'teacher' | 'parent' | 'admin' | 'institution_admin';

const TABS: Record<ShellRole, { href: string; label: string; icon: LucideIcon }[]> = {
  student: [
    { href: '/dashboard/student', label: 'Today', icon: Home },
    { href: '/dashboard/studio', label: 'Studio', icon: Sparkles },
    { href: '/dashboard/student/goals', label: 'Goals', icon: Target },
    { href: '/reads', label: 'Books', icon: BookMarked },
  ],
  teacher: [
    { href: '/dashboard/teacher', label: 'Today', icon: Home },
    { href: '/dashboard/teacher/gradebook', label: 'Marking', icon: ClipboardList },
    { href: '/dashboard/teacher/courses', label: 'Courses', icon: Presentation },
    { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  ],
  parent: [
    { href: '/dashboard/parent', label: 'Today', icon: Home },
    { href: '/dashboard/parent/goals', label: 'Goals', icon: Target },
    { href: '/dashboard/parent/reports', label: 'Reports', icon: FileBarChart },
    { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  ],
  admin: [
    { href: '/dashboard/admin', label: 'Today', icon: Home },
    { href: '/dashboard/admin/users', label: 'People', icon: Users },
    { href: '/dashboard/admin/curriculum', label: 'Builder', icon: Layers },
    { href: '/dashboard/reports', label: 'Reports', icon: FileBarChart },
  ],
  institution_admin: [
    { href: '/dashboard/institution', label: 'Today', icon: Home },
    { href: '/dashboard/reports', label: 'Reports', icon: FileBarChart },
    { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
    { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  ],
};

export function MobileNav({ role, onMore }: { role: ShellRole; onMore: () => void }) {
  const pathname = usePathname();
  const tabs = TABS[role] ?? TABS.student;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map(tab => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-muted-foreground"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
