'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { moduleHomeHref, showsModuleHeader } from '@/lib/module-header';

/**
 * Logo and Home for a full-page module that does not use the marketing header.
 * Pass `force` inside the dashboard, where the studio tools already have a sidebar.
 */
export function ModuleHeader({ force = false }: { force?: boolean }) {
  const pathname = usePathname() ?? '';
  const user = useAuthSTORE(state => state.user);
  if (!force && !showsModuleHeader(pathname)) return null;

  const home = moduleHomeHref(force || Boolean(user));

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center px-4 sm:px-6">
        <Link href={home} className="inline-flex items-center gap-2 text-foreground">
          <Globe className="h-5 w-5" aria-hidden />
          <span className="font-heading text-[18px] tracking-[-0.03em]">Poket School</span>
          <span className="text-[13px] font-semibold text-muted-foreground">Home</span>
        </Link>
      </div>
    </header>
  );
}
