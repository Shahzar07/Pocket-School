/**
 * First-visit language choice, lesson fallback, and locale formatting.
 * Pure functions: no localStorage, no DOM, so they can be unit tested.
 *
 * Browser language wins when it matches a supported code. Timezone is only
 * a hint when the browser language does not. An explicit saved choice is
 * applied by the provider and is never passed in here.
 */

import { DEFAULT_LANGUAGE, getLanguage, isSupportedLanguage } from '../languages';

const TIMEZONE_LANGUAGE: Record<string, string> = {
  'Asia/Kuala_Lumpur': 'ms',
  'Asia/Kuching': 'ms',
  'Asia/Shanghai': 'zh',
  'Asia/Chongqing': 'zh',
  'Asia/Harbin': 'zh',
  'Asia/Urumqi': 'zh',
  'Asia/Colombo': 'ta',
};

function matchSupported(tag: string): string | null {
  const primary = tag.toLowerCase().split(/[-_]/)[0] ?? '';
  return isSupportedLanguage(primary) ? primary : null;
}

export function detectLanguage(
  navigatorLanguages: readonly string[] | undefined,
  timeZone?: string,
): string {
  for (const tag of navigatorLanguages ?? []) {
    if (!tag) continue;
    const code = matchSupported(tag);
    if (code) return code;
  }
  if (timeZone && TIMEZONE_LANGUAGE[timeZone]) return TIMEZONE_LANGUAGE[timeZone];
  return DEFAULT_LANGUAGE;
}

export interface LessonCopySource {
  title?: string;
  aiOutputs?: { text?: string } | null;
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
  const englishText = lesson.aiOutputs?.text ?? '';
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
