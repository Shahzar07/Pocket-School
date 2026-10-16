'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { countryName, dialCode, flagEmoji, searchCountries } from '@/lib/countries';

/**
 * One searchable country control. Sign-up, profile, institutions, billing, and tax use it.
 */
export function CountrySelect({
  value,
  onChange,
  locale = 'en',
  id,
  label = 'Country',
  tone = 'default',
}: {
  value: string;
  onChange: (code: string) => void;
  locale?: string;
  id?: string;
  label?: string;
  tone?: 'default' | 'inverse';
}) {
  const reactId = useId();
  const listId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const options = useMemo(() => searchCountries(query, locale), [query, locale]);
  const selectedName = value ? countryName(value, locale) : '';
  const inverse = tone === 'inverse';

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <span className={inverse ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'block text-[11px] font-semibold text-muted-foreground mb-1'}>
        {label}
      </span>
      <button
        type="button"
        id={listId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={inverse
          ? 'mt-1.5 flex h-12 w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-left text-sm text-white'
          : 'flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm'}
      >
        <span aria-hidden>{value ? flagEmoji(value) : '🏳️'}</span>
        <span className="truncate">{selectedName || 'Choose a country'}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-lg">
          <input
            autoFocus
            aria-label={`Search ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, code, or dial code"
            className="mb-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
          <ul role="listbox" aria-label={label} className="max-h-64 overflow-auto">
            {options.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No country matches that search.</li>}
            {options.map((option) => (
              <li key={option.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.code === value}
                  onClick={() => {
                    onChange(option.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span aria-hidden>{option.flag}</span>
                  <span className="flex-1 truncate text-foreground">{option.name}</span>
                  <span className="text-xs text-muted-foreground">+{option.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** National number beside the dial code of the country already chosen. */
export function PhoneField({
  country,
  value,
  onChange,
  label = 'Phone',
  tone = 'default',
}: {
  country: string;
  value: string;
  onChange: (e164: string) => void;
  label?: string;
  tone?: 'default' | 'inverse';
}) {
  const dial = dialCode(country);
  const national = dial && value.startsWith(`+${dial}`) ? value.slice(dial.length + 1) : value.replace(/^\+/, '');
  const inverse = tone === 'inverse';
  return (
    <label className="block">
      <span className={inverse ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'block text-[11px] font-semibold text-muted-foreground mb-1'}>
        {label}
      </span>
      <span className="mt-1.5 flex gap-2">
        <span className={inverse
          ? 'inline-flex h-12 items-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/70'
          : 'inline-flex h-11 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground'}>
          {dial ? `+${dial}` : '+'}
        </span>
        <input
          aria-label={`${label} number`}
          inputMode="tel"
          value={national}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, '');
            onChange(digits ? `+${dial}${digits}` : '');
          }}
          placeholder="National number"
          className={inverse
            ? 'h-12 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/25'
            : 'h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm'}
        />
      </span>
    </label>
  );
}
