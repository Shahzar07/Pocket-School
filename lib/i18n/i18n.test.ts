import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGUAGES } from '../languages';
import { CATALOG_REVIEW, catalogs, hasUiCatalog, UI_LANGUAGE_CODES } from './catalog';
import { detectLanguage, formatAppDate, formatAppNumber, resolveLessonCopy } from './detect';

function catalogFor(code: string) {
  assert.ok(Object.prototype.hasOwnProperty.call(catalogs, code), code);
  return catalogs[code as keyof typeof catalogs];
}

function flatKeys(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flatKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

const REQUIRED = [
  'en', 'zh', 'zh-Hant', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur', 'id',
  'ms', 'de', 'ja', 'ko', 'tr', 'vi', 'ta', 'th', 'it',
];

test('every supported language has a complete interface catalog', () => {
  const english = flatKeys(catalogs.en).sort();
  for (const lang of LANGUAGES) {
    assert.equal(hasUiCatalog(lang.code), true, lang.code);
    assert.ok(UI_LANGUAGE_CODES.includes(lang.code), lang.code);
    assert.deepEqual(flatKeys(catalogFor(lang.code)).sort(), english, lang.code);
  }
  for (const code of REQUIRED) {
    assert.equal(hasUiCatalog(code), true, code);
  }
  assert.equal(CATALOG_REVIEW.en, 'human');
  assert.equal(CATALOG_REVIEW.ms, 'human');
  assert.equal(CATALOG_REVIEW.zh, 'human');
  assert.equal(CATALOG_REVIEW.ta, 'human');
  for (const code of Object.keys(catalogs)) {
    if (code === 'en' || code === 'ms' || code === 'zh' || code === 'ta') continue;
    assert.equal(CATALOG_REVIEW[code], 'needs-review', code);
  }
});

test('a known country wins over the browser language', () => {
  assert.equal(detectLanguage({ country: 'MY', navigatorLanguages: ['en-US'] }), 'ms');
  assert.equal(detectLanguage({ country: 'US', navigatorLanguages: ['fr-FR'] }), 'en');
  assert.equal(detectLanguage({ country: 'TW', navigatorLanguages: ['zh-CN'] }), 'zh-Hant');
  assert.equal(detectLanguage({ country: 'CN', navigatorLanguages: ['zh-TW'] }), 'zh');
  assert.equal(detectLanguage({ country: 'HK' }), 'zh-Hant');
  assert.equal(detectLanguage({ country: 'IN', region: 'TN', navigatorLanguages: ['en-US'] }), 'ta');
  assert.equal(detectLanguage({ country: 'IN', region: 'PY', navigatorLanguages: ['hi'] }), 'ta');
  assert.equal(detectLanguage({ country: 'IN', region: 'WB' }), 'bn');
  assert.equal(detectLanguage({ country: 'IN', navigatorLanguages: ['en-IN'] }), 'hi');
  assert.equal(detectLanguage({ country: 'CA', region: 'QC', navigatorLanguages: ['en-CA'] }), 'fr');
  assert.equal(detectLanguage({ country: 'ID' }), 'id');
  assert.equal(detectLanguage({ country: 'SA' }), 'ar');
  assert.equal(detectLanguage({ country: 'PK' }), 'ur');
  assert.equal(detectLanguage({ country: 'BD' }), 'bn');
  assert.equal(detectLanguage({ country: 'BR' }), 'pt');
  assert.equal(detectLanguage({ country: 'RU' }), 'ru');
  assert.equal(detectLanguage({ country: 'DE' }), 'de');
  assert.equal(detectLanguage({ country: 'JP' }), 'ja');
  assert.equal(detectLanguage({ country: 'KR' }), 'ko');
  assert.equal(detectLanguage({ country: 'TR' }), 'tr');
  assert.equal(detectLanguage({ country: 'VN' }), 'vi');
  assert.equal(detectLanguage({ country: 'LK' }), 'ta');
  assert.equal(detectLanguage({ country: 'TH' }), 'th');
  assert.equal(detectLanguage({ country: 'IT' }), 'it');
  assert.equal(detectLanguage({ country: 'my' }), 'ms');
});

test('browser language is used when the country is unknown', () => {
  assert.equal(detectLanguage({ country: 'ZZ', navigatorLanguages: ['zh-TW'] }), 'zh-Hant');
  assert.equal(detectLanguage({ navigatorLanguages: ['zh-HK'] }), 'zh-Hant');
  assert.equal(detectLanguage({ navigatorLanguages: ['zh-Hant'] }), 'zh-Hant');
  assert.equal(detectLanguage({ navigatorLanguages: ['zh-MO'] }), 'zh-Hant');
  assert.equal(detectLanguage({ navigatorLanguages: ['zh-CN'] }), 'zh');
  assert.equal(detectLanguage({ navigatorLanguages: ['zh-Hans'] }), 'zh');
  assert.equal(detectLanguage({ navigatorLanguages: ['ms-MY'] }), 'ms');
  assert.equal(detectLanguage({ navigatorLanguages: ['fr-FR'] }), 'fr');
  assert.equal(detectLanguage({ navigatorLanguages: ['ta-IN'] }), 'ta');
  assert.equal(detectLanguage({ country: null, navigatorLanguages: ['xx'] }), 'en');
  assert.equal(detectLanguage({}), 'en');
});

test('lesson copy uses a localization and falls back to english', () => {
  const lesson = {
    title: 'Fractions',
    aiOutputs: { text: 'English body' },
    localizations: {
      ms: { title: 'Pecahan', text: 'Isi Bahasa Melayu' },
      zh: { title: '分数', text: '   ' },
    },
  };
  assert.deepEqual(resolveLessonCopy(lesson, 'ms'), {
    title: 'Pecahan',
    text: 'Isi Bahasa Melayu',
    language: 'ms',
    fellBack: false,
  });
  const zh = resolveLessonCopy(lesson, 'zh');
  assert.equal(zh.fellBack, true);
  assert.equal(zh.language, 'en');
  assert.equal(zh.text, 'English body');
  const en = resolveLessonCopy(lesson, 'en');
  assert.equal(en.fellBack, false);
  assert.equal(en.title, 'Fractions');
});

test('interpolation tokens survive every catalog', () => {
  const tokens: Record<string, string[]> = {
    'switcher.uiFallback': ['{{language}}'],
    'lesson.fallback': ['{{language}}'],
    'cms.confirmBody': ['{{language}}', '{{cost}}'],
    'cms.insufficient': ['{{cost}}'],
    'sparks.heading': ['{{count}}'],
    'sparks.balance': ['{{count}}'],
    'authForm.inboxBody': ['{{email}}'],
  };
  const read = (value: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
  for (const code of Object.keys(catalogs)) {
    for (const [path, expected] of Object.entries(tokens)) {
      const value = read(catalogFor(code), path);
      assert.equal(typeof value, 'string', `${code} ${path}`);
      for (const token of expected) {
        assert.ok(String(value).includes(token), `${code} ${path} missing ${token}`);
      }
    }
  }
});

test('date and number formatters accept interface locales and rtl', () => {
  const when = new Date('2026-10-15T00:00:00Z');
  for (const code of ['en', 'ms', 'zh', 'zh-Hant', 'ta', 'ar', 'ur']) {
    assert.equal(typeof formatAppDate(when, code), 'string');
    assert.ok(formatAppDate(when, code).length > 0);
    assert.equal(typeof formatAppNumber(1234.5, code), 'string');
  }
});
