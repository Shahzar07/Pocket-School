'use client';

import { useEffect, useState } from 'react';
import i18n from 'i18next';
import { READS_EN, type ReadsKey } from './messages';

function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

/** Book UI string. Uses i18next when the language pack has started it. */
export function readsT(key: ReadsKey, vars?: Record<string, string | number>): string {
  const fallback = READS_EN[key];
  let text: string = fallback;
  try {
    if (i18n.isInitialized) {
      const translated = i18n.t(key, { defaultValue: fallback, ...vars });
      if (typeof translated === 'string' && translated.length > 0) text = translated;
    }
  } catch {
    text = fallback;
  }
  return fill(text, vars);
}

export function useReadsT(): (key: ReadsKey, vars?: Record<string, string | number>) => string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(n => n + 1);
    i18n.on?.('languageChanged', bump);
    window.addEventListener('pocket-school-lang-change', bump);
    return () => {
      i18n.off?.('languageChanged', bump);
      window.removeEventListener('pocket-school-lang-change', bump);
    };
  }, []);
  return readsT;
}
