'use client';

import '@/lib/i18n';
import { ThemeToggle } from '@/components/theme-toggle';

/** The offer page already sits in the shared theme provider. This is its toggle. */
export function ReadsOfferThemeToggle() {
  return <ThemeToggle />;
}
