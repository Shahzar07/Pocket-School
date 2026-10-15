'use client';

import i18n from './index';
import { detectLanguage } from './detect';
import {
  DEFAULT_LANGUAGE,
  GEO_COUNTRY_COOKIE,
  GEO_REGION_COOKIE,
  LANGUAGE_SOURCE_KEY,
  LANGUAGE_STORAGE_KEY,
  getLanguage,
  isSupportedLanguage,
  textDirection,
} from '@/lib/languages';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const row = document.cookie.split('; ').find(part => part.startsWith(prefix));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(prefix.length));
  } catch {
    return row.slice(prefix.length);
  }
}

/** Persist a language, point i18next at it, and set lang/dir on the document. */
export function applyAppLanguage(code: string, opts?: { explicit?: boolean }) {
  const next = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  const source = opts?.explicit ? 'user' : 'auto';
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    localStorage.setItem(LANGUAGE_SOURCE_KEY, source);
  } catch {
    /* private mode */
  }
  const lang = getLanguage(next);
  document.documentElement.lang = lang.bcp47;
  document.documentElement.dir = textDirection(next);
  void i18n.changeLanguage(next);
  window.dispatchEvent(new CustomEvent('pocket-school-lang-change', { detail: next }));
}

/** `user` only when the reader (or their profile) chose the language. */
export function readLanguageSource(): 'user' | 'auto' | null {
  if (typeof window === 'undefined') return null;
  try {
    const source = localStorage.getItem(LANGUAGE_SOURCE_KEY);
    return source === 'user' || source === 'auto' ? source : null;
  } catch {
    return null;
  }
}

/**
 * An explicit choice is reused. Anything else is detected again from the
 * Vercel country cookie, then the browser language, and stored as `auto`
 * so a later visit can still follow location.
 */
export function detectAndStoreLanguage(): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (readLanguageSource() === 'user' && stored && isSupportedLanguage(stored)) {
    applyAppLanguage(stored, { explicit: true });
    return stored;
  }
  const detected = detectLanguage({
    country: readCookie(GEO_COUNTRY_COOKIE),
    region: readCookie(GEO_REGION_COOKIE),
    navigatorLanguages: typeof navigator !== 'undefined' ? navigator.languages : undefined,
  });
  applyAppLanguage(detected, { explicit: false });
  return detected;
}
