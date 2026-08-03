/**
 * Single source of truth for every language the platform speaks.
 *
 * These codes are consumed in four different shapes — a picker label, an
 * English name for AI prompts, a BCP-47 tag for speech recognition and TTS,
 * and a text direction. They used to be redeclared in each consumer, which
 * drifted: speech recognition already accepted Malay while the picker could
 * not select it and the tutor would not reply in it. Add a language here and
 * every surface picks it up.
 */

export interface AppLanguage {
  /** Short code stored in localStorage and passed to the AI routes. */
  code: string;
  /** Native name, shown in the picker. */
  label: string;
  /** English name, used when instructing a model which language to reply in. */
  englishName: string;
  flag: string;
  /** Full BCP-47 tag for SpeechRecognition and SpeechSynthesis. */
  bcp47: string;
  /** Right-to-left script. */
  rtl?: boolean;
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English',           englishName: 'English',              flag: '🇬🇧', bcp47: 'en-GB' },
  { code: 'ms', label: 'Bahasa Malaysia',   englishName: 'Malay',                flag: '🇲🇾', bcp47: 'ms-MY' },
  { code: 'id', label: 'Bahasa Indonesia',  englishName: 'Indonesian',           flag: '🇮🇩', bcp47: 'id-ID' },
  { code: 'zh', label: '中文',               englishName: 'Chinese (Simplified)', flag: '🇨🇳', bcp47: 'zh-CN' },
  { code: 'ar', label: 'العربية',            englishName: 'Arabic',               flag: '🇸🇦', bcp47: 'ar-SA', rtl: true },
  { code: 'ur', label: 'اردو',               englishName: 'Urdu',                 flag: '🇵🇰', bcp47: 'ur-PK', rtl: true },
  { code: 'hi', label: 'हिन्दी',               englishName: 'Hindi',                flag: '🇮🇳', bcp47: 'hi-IN' },
  { code: 'es', label: 'Español',           englishName: 'Spanish',              flag: '🇪🇸', bcp47: 'es-ES' },
  { code: 'fr', label: 'Français',          englishName: 'French',               flag: '🇫🇷', bcp47: 'fr-FR' },
  { code: 'de', label: 'Deutsch',           englishName: 'German',               flag: '🇩🇪', bcp47: 'de-DE' },
  { code: 'pt', label: 'Português',         englishName: 'Portuguese',           flag: '🇧🇷', bcp47: 'pt-BR' },
  { code: 'it', label: 'Italiano',          englishName: 'Italian',              flag: '🇮🇹', bcp47: 'it-IT' },
  { code: 'ru', label: 'Русский',           englishName: 'Russian',              flag: '🇷🇺', bcp47: 'ru-RU' },
  { code: 'tr', label: 'Türkçe',            englishName: 'Turkish',              flag: '🇹🇷', bcp47: 'tr-TR' },
  { code: 'ja', label: '日本語',              englishName: 'Japanese',             flag: '🇯🇵', bcp47: 'ja-JP' },
  { code: 'ko', label: '한국어',              englishName: 'Korean',               flag: '🇰🇷', bcp47: 'ko-KR' },
  { code: 'sw', label: 'Kiswahili',         englishName: 'Swahili',              flag: '🇰🇪', bcp47: 'sw-KE' },
];

export const DEFAULT_LANGUAGE = 'en';

/** Key used for the reader's language preference in localStorage. */
export const LANGUAGE_STORAGE_KEY = 'pocket-school-lang';

const BY_CODE = new Map(LANGUAGES.map(l => [l.code, l]));

/**
 * The reader's saved language, safe to call during SSR. Falls back to English
 * for an unset or unrecognised value so a stale code can never be sent to the
 * AI routes.
 */
export function readLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && BY_CODE.has(stored) ? stored : DEFAULT_LANGUAGE;
}

export function getLanguage(code: string | undefined | null): AppLanguage {
  return (code && BY_CODE.get(code)) || BY_CODE.get(DEFAULT_LANGUAGE)!;
}

export function isSupportedLanguage(code: string | undefined | null): boolean {
  return !!code && BY_CODE.has(code);
}

/** English names keyed by code — what the AI routes need to name a target language. */
export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l.englishName]),
);

/** BCP-47 tags keyed by code — for SpeechRecognition and SpeechSynthesis. */
export const RECOGNITION_LANG: Record<string, string> = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l.bcp47]),
);

export function isRtl(code: string | undefined | null): boolean {
  return !!getLanguage(code).rtl;
}

export function textDirection(code: string | undefined | null): 'rtl' | 'ltr' {
  return isRtl(code) ? 'rtl' : 'ltr';
}

/**
 * Instruction appended to an AI prompt so the model answers in the reader's
 * language. Returns '' for English so the default prompt is left untouched.
 */
export function languageInstruction(code: string | undefined | null): string {
  if (!code || code === DEFAULT_LANGUAGE || !BY_CODE.has(code)) return '';
  const name = BY_CODE.get(code)!.englishName;
  return `\n\nIMPORTANT: Reply ENTIRELY in ${name}. Every sentence of your response must be in ${name}, unless quoting a technical term that has no accepted translation.`;
}
