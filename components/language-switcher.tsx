'use client';

import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import {
  LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, textDirection,
} from '@/lib/languages';

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? DEFAULT_LANGUAGE;
    setSelected(stored);
    document.documentElement.lang = stored;
    document.documentElement.dir = textDirection(stored);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (code: string) => {
    setSelected(code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    document.documentElement.lang = code;
    document.documentElement.dir = textDirection(code);
    // Let same-tab listeners (video player, tutor session) react immediately —
    // the native `storage` event only fires in *other* tabs.
    window.dispatchEvent(new CustomEvent('pocket-school-lang-change', { detail: code }));
    setOpen(false);
  };

  const current = LANGUAGES.find(l => l.code === selected) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        title="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 max-h-80 overflow-y-auto bg-card border border-border rounded-2xl shadow-lg py-1 z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                selected === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-foreground hover:bg-muted'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
