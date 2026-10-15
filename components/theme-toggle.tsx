'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const dark = ready && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? t('landing.theme.toLight') : t('landing.theme.toDark')}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
        onDark
          ? 'border-white/30 text-white hover:bg-white/10'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
