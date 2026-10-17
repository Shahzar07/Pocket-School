/**
 * Short emergency push copy. English is the fallback.
 * Malay, Chinese, and Tamil are the other shipped languages.
 */

export type AlertLanguage = 'en' | 'ms' | 'zh' | 'ta';

const TYPES = ['missing_child', 'lockdown', 'weather', 'medical', 'general'] as const;

const COPY: Record<AlertLanguage, Record<(typeof TYPES)[number] | 'open', string>> = {
  en: {
    missing_child: 'Missing child',
    lockdown: 'Lockdown',
    weather: 'Weather',
    medical: 'Medical',
    general: 'Emergency',
    open: 'Open the alert.',
  },
  ms: {
    missing_child: 'Kanak-kanak hilang',
    lockdown: 'Sekatan kawasan',
    weather: 'Cuaca',
    medical: 'Kecemasan perubatan',
    general: 'Kecemasan',
    open: 'Buka amaran.',
  },
  zh: {
    missing_child: '儿童走失',
    lockdown: '封锁',
    weather: '天气',
    medical: '医疗急救',
    general: '紧急情况',
    open: '打开警报。',
  },
  ta: {
    missing_child: 'காணாமல் போன குழந்தை',
    lockdown: 'முடக்க நிலை',
    weather: 'வானிலை',
    medical: 'மருத்துவ அவசரம்',
    general: 'அவசர நிலை',
    open: 'எச்சரிக்கையை திறக்கவும்.',
  },
};

export function alertLanguage(language: string): AlertLanguage {
  const code = language.trim().toLowerCase();
  if (code.startsWith('ms')) return 'ms';
  if (code.startsWith('zh')) return 'zh';
  if (code.startsWith('ta')) return 'ta';
  return 'en';
}

export function localAlertPush(language: string, type: string): { title: string; body: string } {
  const row = COPY[alertLanguage(language)];
  const known = (TYPES as readonly string[]).includes(type) ? type as (typeof TYPES)[number] : 'general';
  return { title: row[known], body: row.open };
}
