'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';

const SiteChrome = dynamic(() => import('@/components/site-chrome').then(mod => mod.SiteChrome));

/**
 * The Reads sales letter keeps its own header. It still follows the public
 * light and dark theme, without auth, Firestore, or the marketing footer.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  if (pathname === '/reads/offer' || pathname.startsWith('/reads/offer/')) {
    return (
      <ThemeProvider>
        <div id="content">{children}</div>
      </ThemeProvider>
    );
  }
  return <SiteChrome>{children}</SiteChrome>;
}
