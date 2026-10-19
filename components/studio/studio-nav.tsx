'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-3 py-2" aria-label="AI Studio" data-studio-nav="header">
      {LINKS.map((link) => {
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
  return (
    <div className="flex min-h-0 flex-col bg-background" data-studio-shell="standalone">
      <StudioNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
