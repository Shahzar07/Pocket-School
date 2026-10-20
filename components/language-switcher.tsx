'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Globe, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthSTORE } from '@/hooks/use-auth';
import { updateUser } from '@/lib/db';
import {
  GEO_COUNTRY_COOKIE,
  GEO_REGION_COOKIE,
  LANGUAGE_REGIONS,
  LANGUAGES,
  readLanguage,
  getLanguage,
  type LanguageRegion,
} from '@/lib/languages';
import { applyAppLanguage, readLanguageSource } from '@/lib/i18n/apply';
import { hasUiCatalog } from '@/lib/i18n/catalog';
import { languageShortcut, suggestedLanguage } from '@/lib/i18n/detect';

const SUGGEST_DISMISS_KEY = 'poket-lang-suggest-dismissed';

const REGION_KEY: Record<LanguageRegion, string> = {
  Default: 'default',
  Europe: 'europe',
  'Middle East': 'middleEast',
  'South Asia': 'southAsia',
  'Southeast Asia': 'southeastAsia',
  'East Asia': 'eastAsia',
  'Central Asia': 'centralAsia',
  Africa: 'africa',
  Americas: 'americas',
};

function groupedLanguages(query: string): { region: LanguageRegion; languages: typeof LANGUAGES[number][] }[] {
  const q = query.trim().toLowerCase();
  const filtered = LANGUAGES.filter((language) =>
    !q
    || language.label.toLowerCase().includes(q)
    || language.englishName.toLowerCase().includes(q)
    || language.code.toLowerCase().includes(q),
  );
  return LANGUAGE_REGIONS
    .map((region) => ({ region, languages: filtered.filter((language) => language.region === region) }))
    .filter((group) => group.languages.length > 0);
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const row = document.cookie.split('; ').find(part => part.startsWith(prefix));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(prefix.length));
  } catch {
    return row.slice(prefix.length);
  }
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(SUGGEST_DISMISS_KEY);
  } catch {
    return null;
  }
}

export function LanguageSwitcher({ tone = 'default', compact = false }: { tone?: 'default' | 'onDark'; compact?: boolean }) {
  const { t } = useTranslation();
  const { user, profile, setProfile } = useAuthSTORE();
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [selected, setSelected] = useState('en');
  const [country, setCountry] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      const current = readLanguage();
      const nextCountry = readCookie(GEO_COUNTRY_COOKIE);
      setSelected(current);
      setCountry(nextCountry);
      setSuggestion(suggestedLanguage({
        country: nextCountry,
        region: readCookie(GEO_REGION_COOKIE),
        current,
        source: readLanguageSource(),
        dismissed: readDismissed(),
      }));
    };
    sync();
    window.addEventListener('pocket-school-lang-change', sync);
    return () => window.removeEventListener('pocket-school-lang-change', sync);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlaced(false);
      return;
    }
    const place = () => {
      const root = ref.current;
      const menu = menuRef.current;
      if (!root || !menu) return;
      const trigger = root.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(320, window.innerWidth - margin * 2);
      const rtl = document.documentElement.dir === 'rtl';
      let left = rtl ? trigger.left : trigger.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
      const top = Math.max(margin, trigger.bottom + 6);
      menu.style.width = `${width}px`;
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      setPlaced(true);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const select = (code: string) => {
    setSelected(code);
    setSuggestion(null);
    applyAppLanguage(code, { explicit: true });
    setOpen(false);
    if (!user) return;
    updateUser(user.uid, { language: code })
      .then(() => {
        if (profile) setProfile({ ...profile, language: code });
      })
      .catch(() => {});
  };

  const dismissSuggestion = () => {
    if (!suggestion) return;
    try {
      localStorage.setItem(SUGGEST_DISMISS_KEY, suggestion);
    } catch {
      /* private mode */
    }
    setSuggestion(null);
  };

  const current = LANGUAGES.find(l => l.code === selected) ?? LANGUAGES[0];
  const groups = groupedLanguages(query);
  const showFallback = !hasUiCatalog(selected);
  const shortcutCode = languageShortcut(country, selected);
  const shortcut = shortcutCode ? getLanguage(shortcutCode) : null;
  const suggestionLabel = suggestion === 'ms'
    ? t('suggest.malay')
    : suggestion
      ? t('suggest.switch', { language: getLanguage(suggestion).label })
      : '';

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      {!compact && shortcut && (
        <button
          type="button"
          data-lang-shortcut={shortcut.code}
          onClick={() => select(shortcut.code)}
          className={`px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            tone === 'onDark'
              ? 'text-white/90 hover:bg-white/10'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {shortcut.label}
        </button>
      )}
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
        {compact ? <span className="sr-only">{current.label}</span> : (
          <>
            <span className="hidden sm:inline">{current.flag} {current.label}</span>
            <span className="sm:hidden">{current.flag}</span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          data-lang-menu
          className={`fixed z-[60] max-h-[70vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-lg py-1 ${
            placed ? 'visible' : 'invisible'
          }`}
        >
          <div className="sticky top-0 z-10 bg-card px-3 pt-2 pb-2 border-b border-border">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('switcher.search')}
              aria-label={t('switcher.search')}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
          </div>
          {groups.map((group) => (
            <div key={group.region}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(`switcher.region.${REGION_KEY[group.region]}`)}
              </p>
              {group.languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => select(lang.code)}
                  dir={lang.rtl ? 'rtl' : 'ltr'}
                  className={`w-full text-start px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                    selected === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{lang.label}</span>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground">{lang.englishName}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t('switcher.none')}</p>
          )}
          {showFallback && (
            <p className="px-4 py-2 text-[11px] leading-snug text-muted-foreground border-t border-border">
              {t('switcher.uiFallback', { language: getLanguage(selected).label })}
            </p>
          )}
        </div>
      )}

      {suggestion && (
        <div
          data-lang-suggest={suggestion}
          className="fixed z-[70] top-20 inset-x-3 sm:inset-x-auto sm:end-4 sm:max-w-sm flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-lg"
        >
          <button
            type="button"
            onClick={() => select(suggestion)}
            className="flex-1 text-start text-sm font-semibold text-foreground"
          >
            {suggestionLabel}
          </button>
          <button
            type="button"
            onClick={dismissSuggestion}
            aria-label={t('suggest.dismiss')}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
