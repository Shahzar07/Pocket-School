'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const SiteChrome = dynamic(() => import('@/components/site-chrome').then(mod => mod.SiteChrome));

/**
 * The Reads sales letter is a static page. It does not load auth, Firestore
 * or the marketing footer. Every other route keeps the existing chrome.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  if (pathname === '/reads/offer' || pathname.startsWith('/reads/offer/')) {
    return <div id="content">{children}</div>;
  }
  return <SiteChrome>{children}</SiteChrome>;
}
