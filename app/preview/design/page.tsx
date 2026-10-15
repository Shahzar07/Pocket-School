'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { DesignDesk } from '@/components/shell/design-desk';
import type { ShellRole } from '@/components/shell/mobile-nav';

const ROLES: ShellRole[] = ['student', 'teacher', 'parent', 'admin', 'institution_admin'];

function ThemeFromQuery({ theme }: { theme: string | null }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (theme === 'dark' || theme === 'light') setTheme(theme);
  }, [theme, setTheme]);
  return null;
}

function Desk() {
  const params = useSearchParams();
  const requested = params.get('role') ?? 'student';
  const role = ROLES.includes(requested as ShellRole) ? requested as ShellRole : 'student';
  return (
    <>
      <ThemeFromQuery theme={params.get('theme')} />
      <DesignDesk role={role} />
    </>
  );
}

export default function DesignPreviewPage() {
  return (
    <Suspense fallback={<div className="ps-skeleton min-h-screen" aria-hidden="true" />}>
      <Desk />
    </Suspense>
  );
}
