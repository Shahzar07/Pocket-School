'use client';

import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pocket-school-lang') ?? 'en';
    setSelected(stored);
    document.documentElement.lang = stored;
    document.documentElement.dir = stored === 'ar' ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (code: string) => {
    setSelected(code);
    localStorage.setItem('pocket-school-lang', code);
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    setOpen(false);
  };

  const current = LANGUAGES.find(l => l.code === selected) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
        title="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-[#DADCE0] rounded-2xl shadow-lg py-1 z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                selected === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-[#202124] hover:bg-[#F1F3F4]'
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
