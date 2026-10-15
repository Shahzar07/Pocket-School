'use client';

import i18n from './index';
import { detectLanguage } from './detect';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguage,
  isSupportedLanguage,
  textDirection,
} from '@/lib/languages';

/** Persist a language, point i18next at it, and set lang/dir on the document. */
export function applyAppLanguage(code: string) {
  const next = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  const lang = getLanguage(next);
  document.documentElement.lang = lang.bcp47;
  document.documentElement.dir = textDirection(next);
  void i18n.changeLanguage(next);
  window.dispatchEvent(new CustomEvent('pocket-school-lang-change', { detail: next }));
}

/**
 * Use a saved choice when one exists. Otherwise detect from the browser,
 * then the timezone, and store that so the next visit does not re-detect.
 */
export function detectAndStoreLanguage(): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored && isSupportedLanguage(stored)) {
    applyAppLanguage(stored);
    return stored;
  }
  const detected = detectLanguage(
    typeof navigator !== 'undefined' ? navigator.languages : undefined,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  applyAppLanguage(detected);
  return detected;
}
