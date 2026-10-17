'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-provider';
import { CookieConsent } from '@/components/cookie-consent';
import { I18nProvider } from '@/components/i18n-provider';
import { ModuleHeader } from '@/components/module-header';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TenantChrome } from '@/components/tenant-chrome';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { WhiteLabelProvider } from '@/components/white-label-provider';

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nProvider>
          <WhiteLabelProvider>
            <SiteHeader />
            <TenantChrome />
            <ModuleHeader />
            <div id="content">{children}</div>
            <SiteFooter />
            <CookieConsent />
            <Toaster />
          </WhiteLabelProvider>
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
