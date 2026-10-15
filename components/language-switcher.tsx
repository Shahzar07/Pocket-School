'use client';

import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthSTORE } from '@/hooks/use-auth';
import { updateUser } from '@/lib/db';
import { LANGUAGES, readLanguage, getLanguage } from '@/lib/languages';
import { applyAppLanguage } from '@/lib/i18n/apply';
import { hasUiCatalog } from '@/lib/i18n/catalog';

export function LanguageSwitcher({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  const { t } = useTranslation();
  const { user, profile, setProfile } = useAuthSTORE();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setSelected(readLanguage());
    sync();
    const onCustom = () => sync();
    window.addEventListener('pocket-school-lang-change', onCustom);
    return () => window.removeEventListener('pocket-school-lang-change', onCustom);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (code: string) => {
    setSelected(code);
    applyAppLanguage(code, { explicit: true });
    setOpen(false);
    if (!user) return;
    updateUser(user.uid, { language: code })
      .then(() => {
        if (profile) setProfile({ ...profile, language: code });
      })
      .catch(() => {});
  };

  const current = LANGUAGES.find(l => l.code === selected) ?? LANGUAGES[0];
  const showFallback = !hasUiCatalog(selected);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
          tone === 'onDark'
            ? 'text-white/90 hover:bg-white/10'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        title={t('switcher.change')}
        aria-label={t('switcher.change')}
        aria-expanded={open}
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute end-0 mt-1 w-60 max-h-80 overflow-y-auto bg-card border border-border rounded-2xl shadow-lg py-1 z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => select(lang.code)}
              className={`w-full text-start px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                selected === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-foreground hover:bg-muted'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
          {showFallback && (
            <p className="px-4 py-2 text-[11px] leading-snug text-muted-foreground border-t border-border">
              {t('switcher.uiFallback', { language: getLanguage(selected).label })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
