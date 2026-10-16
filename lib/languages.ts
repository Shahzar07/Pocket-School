/**
 * Single source of truth for every language the platform speaks.
 *
 * These codes are consumed in four different shapes — a picker label, an
 * English name for AI prompts, a BCP-47 tag for speech recognition and TTS,
 * and a text direction. They used to be redeclared in each consumer, which
 * drifted: speech recognition already accepted Malay while the picker could
 * not select it and the tutor would not reply in it. Add a language here and
 * every surface picks it up.
 *
 * Human catalogs: English, Bahasa Melayu, Chinese (Simplified) and Tamil.
 * Every other code has an AI-assisted catalog marked for review in
 * `lib/i18n/catalog.ts`. The interface stays English until the reader
 * chooses a language. That choice is stored in the `poket-lang` cookie,
 * in localStorage (source `user`), and on `users/{uid}.language`.
 * Geolocation never changes the language; it can only suggest one.
 */

export type LanguageRegion =
  | 'Default'
  | 'Europe'
  | 'Middle East'
  | 'South Asia'
  | 'Southeast Asia'
  | 'East Asia'
  | 'Central Asia'
  | 'Africa'
  | 'Americas';

export const LANGUAGE_REGIONS: readonly LanguageRegion[] = [
  'Default',
  'East Asia',
  'South Asia',
  'Southeast Asia',
  'Middle East',
  'Europe',
  'Central Asia',
  'Africa',
  'Americas',
];

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
  /** Picker group. English stays in Default. */
  region: LanguageRegion;
  /** Right-to-left script. */
  rtl?: boolean;
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English', englishName: 'English', flag: '🇬🇧', bcp47: 'en-GB', region: 'Default' },
  { code: 'zh', label: '简体中文', englishName: 'Chinese (Simplified)', flag: '🇨🇳', bcp47: 'zh-CN', region: 'East Asia' },
  { code: 'zh-Hant', label: '繁體中文', englishName: 'Chinese (Traditional)', flag: '🇹🇼', bcp47: 'zh-TW', region: 'East Asia' },
  { code: 'yue', label: '粵語', englishName: 'Cantonese', flag: '🇭🇰', bcp47: 'yue-HK', region: 'East Asia' },
  { code: 'ja', label: '日本語', englishName: 'Japanese', flag: '🇯🇵', bcp47: 'ja-JP', region: 'East Asia' },
  { code: 'ko', label: '한국어', englishName: 'Korean', flag: '🇰🇷', bcp47: 'ko-KR', region: 'East Asia' },
  { code: 'hi', label: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳', bcp47: 'hi-IN', region: 'South Asia' },
  { code: 'bn', label: 'বাংলা', englishName: 'Bengali', flag: '🇧🇩', bcp47: 'bn-BD', region: 'South Asia' },
  { code: 'ur', label: 'اردو', englishName: 'Urdu', flag: '🇵🇰', bcp47: 'ur-PK', region: 'South Asia', rtl: true },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', flag: '🇮🇳', bcp47: 'pa-IN', region: 'South Asia' },
  { code: 'ta', label: 'தமிழ்', englishName: 'Tamil', flag: '🇮🇳', bcp47: 'ta-IN', region: 'South Asia' },
  { code: 'te', label: 'తెలుగు', englishName: 'Telugu', flag: '🇮🇳', bcp47: 'te-IN', region: 'South Asia' },
  { code: 'mr', label: 'मराठी', englishName: 'Marathi', flag: '🇮🇳', bcp47: 'mr-IN', region: 'South Asia' },
  { code: 'gu', label: 'ગુજરાતી', englishName: 'Gujarati', flag: '🇮🇳', bcp47: 'gu-IN', region: 'South Asia' },
  { code: 'kn', label: 'ಕನ್ನಡ', englishName: 'Kannada', flag: '🇮🇳', bcp47: 'kn-IN', region: 'South Asia' },
  { code: 'ml', label: 'മലയാളം', englishName: 'Malayalam', flag: '🇮🇳', bcp47: 'ml-IN', region: 'South Asia' },
  { code: 'ne', label: 'नेपाली', englishName: 'Nepali', flag: '🇳🇵', bcp47: 'ne-NP', region: 'South Asia' },
  { code: 'or', label: 'ଓଡ଼ିଆ', englishName: 'Odia', flag: '🇮🇳', bcp47: 'or-IN', region: 'South Asia' },
  { code: 'si', label: 'සිංහල', englishName: 'Sinhala', flag: '🇱🇰', bcp47: 'si-LK', region: 'South Asia' },
  { code: 'id', label: 'Bahasa Indonesia', englishName: 'Indonesian', flag: '🇮🇩', bcp47: 'id-ID', region: 'Southeast Asia' },
  { code: 'jv', label: 'Basa Jawa', englishName: 'Javanese', flag: '🇮🇩', bcp47: 'jv-ID', region: 'Southeast Asia' },
  { code: 'ms', label: 'Bahasa Melayu', englishName: 'Malay', flag: '🇲🇾', bcp47: 'ms-MY', region: 'Southeast Asia' },
  { code: 'vi', label: 'Tiếng Việt', englishName: 'Vietnamese', flag: '🇻🇳', bcp47: 'vi-VN', region: 'Southeast Asia' },
  { code: 'th', label: 'ไทย', englishName: 'Thai', flag: '🇹🇭', bcp47: 'th-TH', region: 'Southeast Asia' },
  { code: 'fil', label: 'Filipino', englishName: 'Filipino', flag: '🇵🇭', bcp47: 'fil-PH', region: 'Southeast Asia' },
  { code: 'my', label: 'မြန်မာ', englishName: 'Burmese', flag: '🇲🇲', bcp47: 'my-MM', region: 'Southeast Asia' },
  { code: 'km', label: 'ភាសាខ្មែរ', englishName: 'Khmer', flag: '🇰🇭', bcp47: 'km-KH', region: 'Southeast Asia' },
  { code: 'ar', label: 'العربية', englishName: 'Arabic', flag: '🇸🇦', bcp47: 'ar-SA', region: 'Middle East', rtl: true },
  { code: 'he', label: 'עברית', englishName: 'Hebrew', flag: '🇮🇱', bcp47: 'he-IL', region: 'Middle East', rtl: true },
  { code: 'fa', label: 'فارسی', englishName: 'Persian', flag: '🇮🇷', bcp47: 'fa-IR', region: 'Middle East', rtl: true },
  { code: 'ps', label: 'پښتو', englishName: 'Pashto', flag: '🇦🇫', bcp47: 'ps-AF', region: 'Middle East', rtl: true },
  { code: 'tr', label: 'Türkçe', englishName: 'Turkish', flag: '🇹🇷', bcp47: 'tr-TR', region: 'Europe' },
  { code: 'ru', label: 'Русский', englishName: 'Russian', flag: '🇷🇺', bcp47: 'ru-RU', region: 'Europe' },
  { code: 'de', label: 'Deutsch', englishName: 'German', flag: '🇩🇪', bcp47: 'de-DE', region: 'Europe' },
  { code: 'fr', label: 'Français', englishName: 'French', flag: '🇫🇷', bcp47: 'fr-FR', region: 'Europe' },
  { code: 'it', label: 'Italiano', englishName: 'Italian', flag: '🇮🇹', bcp47: 'it-IT', region: 'Europe' },
  { code: 'pt-PT', label: 'Português (Portugal)', englishName: 'Portuguese (Portugal)', flag: '🇵🇹', bcp47: 'pt-PT', region: 'Europe' },
  { code: 'nl', label: 'Nederlands', englishName: 'Dutch', flag: '🇳🇱', bcp47: 'nl-NL', region: 'Europe' },
  { code: 'pl', label: 'Polski', englishName: 'Polish', flag: '🇵🇱', bcp47: 'pl-PL', region: 'Europe' },
  { code: 'uk', label: 'Українська', englishName: 'Ukrainian', flag: '🇺🇦', bcp47: 'uk-UA', region: 'Europe' },
  { code: 'ro', label: 'Română', englishName: 'Romanian', flag: '🇷🇴', bcp47: 'ro-RO', region: 'Europe' },
  { code: 'el', label: 'Ελληνικά', englishName: 'Greek', flag: '🇬🇷', bcp47: 'el-GR', region: 'Europe' },
  { code: 'cs', label: 'Čeština', englishName: 'Czech', flag: '🇨🇿', bcp47: 'cs-CZ', region: 'Europe' },
  { code: 'hu', label: 'Magyar', englishName: 'Hungarian', flag: '🇭🇺', bcp47: 'hu-HU', region: 'Europe' },
  { code: 'sv', label: 'Svenska', englishName: 'Swedish', flag: '🇸🇪', bcp47: 'sv-SE', region: 'Europe' },
  { code: 'kk', label: 'Қазақша', englishName: 'Kazakh', flag: '🇰🇿', bcp47: 'kk-KZ', region: 'Central Asia' },
  { code: 'uz', label: 'Oʻzbekcha', englishName: 'Uzbek', flag: '🇺🇿', bcp47: 'uz-UZ', region: 'Central Asia' },
  { code: 'sw', label: 'Kiswahili', englishName: 'Swahili', flag: '🇰🇪', bcp47: 'sw-KE', region: 'Africa' },
  { code: 'ha', label: 'Hausa', englishName: 'Hausa', flag: '🇳🇬', bcp47: 'ha-NG', region: 'Africa' },
  { code: 'yo', label: 'Yorùbá', englishName: 'Yoruba', flag: '🇳🇬', bcp47: 'yo-NG', region: 'Africa' },
  { code: 'am', label: 'አማርኛ', englishName: 'Amharic', flag: '🇪🇹', bcp47: 'am-ET', region: 'Africa' },
  { code: 'es', label: 'Español', englishName: 'Spanish', flag: '🇪🇸', bcp47: 'es-ES', region: 'Americas' },
  { code: 'pt', label: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', flag: '🇧🇷', bcp47: 'pt-BR', region: 'Americas' },
];

export const DEFAULT_LANGUAGE = 'en';

/** Key used for the reader's language preference in localStorage. */
export const LANGUAGE_STORAGE_KEY = 'pocket-school-lang';

/**
 * `user` when the reader picked a language (or their profile has one).
 * `auto` when the value was only a geolocation or browser default, so the
 * next visit may detect again.
 */
export const LANGUAGE_SOURCE_KEY = 'pocket-school-lang-source';

/** Explicit language choice. Set only when the reader picks a language. */
export const LANGUAGE_COOKIE = 'poket-lang';

/** Country and region cookies set from Vercel's geo headers. */
export const GEO_COUNTRY_COOKIE = 'poket-geo-country';
export const GEO_REGION_COOKIE = 'poket-geo-region';

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
