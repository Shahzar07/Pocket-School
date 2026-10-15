/**
 * Language a visitor might prefer, used only as a dismissible suggestion.
 *
 * Order: Vercel country (with a few region overrides), then the browser
 * language list, then English. Nothing in this module changes the interface.
 * The interface stays English until the reader chooses, and that choice is
 * applied by the provider.
 */

import { DEFAULT_LANGUAGE, isSupportedLanguage } from '../languages';
import { getLanguage } from '../languages';
import { readLessonBody } from '../lesson-body';

/** ISO country → interface language. Unknown countries fall through. */
const COUNTRY_LANGUAGE: Record<string, string> = {
  MY: 'ms', BN: 'ms',
  ID: 'id',
  CN: 'zh',
  TW: 'zh-Hant', HK: 'zh-Hant', MO: 'zh-Hant',
  IN: 'hi',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es',
  GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es',
  CR: 'es', PA: 'es', UY: 'es', PR: 'es',
  FR: 'fr', BE: 'fr', SN: 'fr', CI: 'fr', CM: 'fr', MG: 'fr', ML: 'fr', NE: 'fr',
  BF: 'fr', TG: 'fr', BJ: 'fr', CD: 'fr', CG: 'fr', GA: 'fr', GN: 'fr', HT: 'fr',
  LU: 'fr', MC: 'fr',
  SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar', JO: 'ar',
  LB: 'ar', SY: 'ar', IQ: 'ar', YE: 'ar', LY: 'ar', TN: 'ar', DZ: 'ar', MA: 'ar',
  SD: 'ar', PS: 'ar', MR: 'ar',
  BD: 'bn',
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt',
  RU: 'ru', BY: 'ru', KG: 'ru',
  KZ: 'kk',
  PK: 'ur',
  DE: 'de', AT: 'de', LI: 'de', CH: 'de',
  JP: 'ja',
  KR: 'ko', KP: 'ko',
  TR: 'tr',
  VN: 'vi',
  LK: 'ta',
  TH: 'th',
  IT: 'it', SM: 'it',
  US: 'en', GB: 'en', AU: 'en', NZ: 'en', IE: 'en', CA: 'en', SG: 'en', ZA: 'en',
  NG: 'en', PH: 'en', KE: 'en',
};

/** `${country}-${region}` overrides, using Vercel's region code. */
const REGION_LANGUAGE: Record<string, string> = {
  'IN-TN': 'ta',
  'IN-PY': 'ta',
  'IN-WB': 'bn',
  'CA-QC': 'fr',
};

function matchBrowserTag(tag: string): string | null {
  const lower = tag.trim().toLowerCase().replace(/_/g, '-');
  if (!lower) return null;
  if (
    lower === 'zh-hant' ||
    lower.startsWith('zh-hant-') ||
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hk') ||
    lower.startsWith('zh-mo')
  ) {
    return 'zh-Hant';
  }
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh';
  const primary = lower.split('-')[0] ?? '';
  return isSupportedLanguage(primary) ? primary : null;
}

export function detectLanguage(input: {
  country?: string | null;
  region?: string | null;
  navigatorLanguages?: readonly string[] | null;
}): string {
  const country = input.country?.trim().toUpperCase() ?? '';
  const region = input.region?.trim().toUpperCase() ?? '';
  if (country && region) {
    const regional = REGION_LANGUAGE[`${country}-${region}`];
    if (regional && isSupportedLanguage(regional)) return regional;
  }
  if (country && COUNTRY_LANGUAGE[country] && isSupportedLanguage(COUNTRY_LANGUAGE[country])) {
    return COUNTRY_LANGUAGE[country];
  }
  for (const tag of input.navigatorLanguages ?? []) {
    if (!tag) continue;
    const code = matchBrowserTag(tag);
    if (code) return code;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * The language to show before any suggestion. An explicit localStorage choice
 * wins, then the language cookie, then English. A previous automatic value
 * is ignored so a visit from Malaysia still opens in English.
 */
export function initialLanguage(input: {
  stored?: string | null;
  source?: string | null;
  cookie?: string | null;
}): string {
  if (input.source === 'user' && isSupportedLanguage(input.stored ?? '')) return input.stored as string;
  if (isSupportedLanguage(input.cookie ?? '')) return input.cookie as string;
  return DEFAULT_LANGUAGE;
}

/**
 * Geolocation may offer a language. It never includes the browser language,
 * English, the language already on screen, a choice the reader made, or a
 * suggestion they dismissed.
 */
export function suggestedLanguage(input: {
  country?: string | null;
  region?: string | null;
  current?: string | null;
  source?: string | null;
  dismissed?: string | null;
}): string | null {
  if (input.source === 'user') return null;
  const detected = detectLanguage({
    country: input.country,
    region: input.region,
    navigatorLanguages: [],
  });
  const current = input.current && isSupportedLanguage(input.current) ? input.current : DEFAULT_LANGUAGE;
  if (!detected || detected === DEFAULT_LANGUAGE || detected === current) return null;
  if (input.dismissed && input.dismissed === detected) return null;
  return detected;
}

/**
 * A one-click alternate for a country whose readers commonly use a second
 * language. Kazakhstan offers Russian beside the picker; once Russian is
 * active, Kazakh is the one-click way back. It does not change the language
 * until the reader clicks it.
 */
export function languageShortcut(country: string | null | undefined, current: string): string | null {
  const code = country?.trim().toUpperCase() ?? '';
  if (code !== 'KZ') return null;
  if (current === 'kk') return 'ru';
  if (current === 'ru') return 'kk';
  return null;
}

export interface LessonCopySource {
  title?: string;
  aiOutputs?: { text?: string } | null;
  contentSources?: { type: string; value: string }[] | null;
  localizations?: Record<string, { title?: string; text?: string } | undefined> | null;
}

export interface ResolvedLessonCopy {
  title: string;
  text: string;
  /** Language the returned copy is actually in. */
  language: string;
  /** True when the reader asked for another language and English was used. */
  fellBack: boolean;
}

/**
 * English is the source of a lesson (`title` and `aiOutputs.text`).
 * A localization is used only when that language has a non-empty body.
 */
export function resolveLessonCopy(lesson: LessonCopySource, language: string): ResolvedLessonCopy {
  const englishTitle = lesson.title ?? '';
  const englishText = readLessonBody(lesson);
  if (!language || language === DEFAULT_LANGUAGE || !isSupportedLanguage(language)) {
    return { title: englishTitle, text: englishText, language: DEFAULT_LANGUAGE, fellBack: false };
  }
  const localized = lesson.localizations?.[language];
  const text = localized?.text?.trim() ?? '';
  if (!text) {
    return { title: englishTitle, text: englishText, language: DEFAULT_LANGUAGE, fellBack: true };
  }
  return {
    title: localized?.title?.trim() || englishTitle,
    text,
    language,
    fellBack: false,
  };
}

export function formatAppDate(
  value: Date | number,
  language: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(
    getLanguage(language).bcp47,
    options ?? { dateStyle: 'medium' },
  ).format(value);
}

export function formatAppNumber(
  value: number,
  language: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getLanguage(language).bcp47, options).format(value);
}
