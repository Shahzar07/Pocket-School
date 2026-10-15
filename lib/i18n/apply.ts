'use client';

import i18n from './index';
import { initialLanguage } from './detect';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
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

const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Persist a language, point i18next at it, and set lang/dir on the document. */
export function applyAppLanguage(code: string, opts?: { explicit?: boolean }) {
  const next = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  const explicit = opts?.explicit === true;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    localStorage.setItem(LANGUAGE_SOURCE_KEY, explicit ? 'user' : 'auto');
  } catch {
    /* private mode */
  }
  if (explicit) {
    document.cookie = `${LANGUAGE_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax`;
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
 * Reuse an explicit choice from localStorage or the language cookie.
 * Anything else stays English. A previous automatic detection is cleared
 * so geolocation cannot switch the interface on the next visit.
 */
export function detectAndStoreLanguage(): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const source = readLanguageSource();
  const cookie = readCookie(LANGUAGE_COOKIE);
  const next = initialLanguage({ stored, source, cookie });
  const explicit = (source === 'user' && isSupportedLanguage(stored)) || isSupportedLanguage(cookie);
  if (explicit) {
    applyAppLanguage(next, { explicit: true });
    return next;
  }
  try {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    localStorage.removeItem(LANGUAGE_SOURCE_KEY);
  } catch {
    /* private mode */
  }
  const lang = getLanguage(DEFAULT_LANGUAGE);
  document.documentElement.lang = lang.bcp47;
  document.documentElement.dir = textDirection(DEFAULT_LANGUAGE);
  void i18n.changeLanguage(DEFAULT_LANGUAGE);
  window.dispatchEvent(new CustomEvent('pocket-school-lang-change', { detail: DEFAULT_LANGUAGE }));
  return DEFAULT_LANGUAGE;
}
