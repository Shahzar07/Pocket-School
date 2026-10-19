'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard/studio/et', label: 'ET AI' },
  { href: '/dashboard/studio/teachers', label: 'AI Teachers' },
  { href: '/dashboard/studio/maths', label: 'ET Maths' },
  { href: '/dashboard/studio/exam-prep', label: 'ET Exams' },
  { href: '/dashboard/studio/essays', label: 'ET Essays' },
  { href: '/dashboard/store', label: 'Creator Store' },
  { href: '/dashboard/admin/books', label: 'AI Book Creator' },
] as const;

export function StudioNav() {
  const pathname = usePathname() ?? '';
  return (
    <aside className="shrink-0 border-b border-border bg-card md:w-56 md:border-b-0 md:border-r">
      <p className="px-4 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">AI Studio</p>
      <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col" aria-label="AI Studio">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${active ? 'bg-[#3FE0D0] text-[#203337]' : 'text-[#1E6A83] hover:bg-muted'}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function StudioFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background md:flex-row">
      <StudioNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
