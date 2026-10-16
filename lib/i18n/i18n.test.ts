import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGUAGES, isRtl } from '../languages';
import { CATALOG_REVIEW, catalogs, hasUiCatalog, UI_LANGUAGE_CODES } from './catalog';
import { detectLanguage, formatAppDate, formatAppNumber, initialLanguage, languageShortcut, resolveLessonCopy, suggestedLanguage } from './detect';

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
  'ms', 'de', 'ja', 'ko', 'tr', 'vi', 'ta', 'th', 'it', 'kk',
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

test('a known country is only a suggestion and never the default language', () => {
  assert.equal(initialLanguage({ source: 'auto', stored: 'ms' }), 'en');
  assert.equal(initialLanguage({ source: null, stored: 'ms' }), 'en');
  assert.equal(initialLanguage({ source: 'user', stored: 'ms' }), 'ms');
  assert.equal(initialLanguage({ source: 'user', stored: 'en', cookie: 'ms' }), 'en');
  assert.equal(initialLanguage({ cookie: 'fr' }), 'fr');
  assert.equal(initialLanguage({}), 'en');
  assert.equal(suggestedLanguage({ country: 'MY', current: 'en' }), 'ms');
  assert.equal(suggestedLanguage({ country: 'MY', current: 'en', source: 'user' }), null);
  assert.equal(suggestedLanguage({ country: 'MY', current: 'en', dismissed: 'ms' }), null);
  assert.equal(suggestedLanguage({ country: 'MY', current: 'ms' }), null);
  assert.equal(suggestedLanguage({ country: null, current: 'en' }), null);
  assert.equal(catalogs.en.suggest.malay, 'Tukar ke Bahasa Melayu?');
  assert.equal(catalogs.ms.suggest.malay, 'Tukar ke Bahasa Melayu?');
  assert.notEqual(catalogs.ms.market.search, catalogs.en.market.search);
  assert.notEqual(catalogs.ms.signup.createTitle, catalogs.en.signup.createTitle);
  assert.notEqual(catalogs.ms.signup.programme, catalogs.en.signup.programme);
  assert.notEqual(catalogs.zh.market.badge, catalogs.en.market.badge);
  assert.notEqual(catalogs.ta.signup.yearLevel, catalogs.en.signup.yearLevel);
});

test('a known country is the suggested language ahead of the browser', () => {
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
  assert.equal(detectLanguage({ country: 'RU', navigatorLanguages: ['kk-KZ'] }), 'ru');
  assert.equal(detectLanguage({ country: 'KZ', navigatorLanguages: ['ru-RU', 'en-US'] }), 'kk');
  assert.equal(detectLanguage({ country: 'BY' }), 'ru');
  assert.equal(languageShortcut('KZ', 'kk'), 'ru');
  assert.equal(languageShortcut('kz', 'ru'), 'kk');
  assert.equal(languageShortcut('RU', 'ru'), null);
  assert.equal(languageShortcut('KZ', 'en'), null);
  assert.equal(detectLanguage({ country: 'DE' }), 'de');
  assert.equal(detectLanguage({ country: 'JP' }), 'ja');
  assert.equal(detectLanguage({ country: 'KR' }), 'ko');
  assert.equal(detectLanguage({ country: 'TR' }), 'tr');
  assert.equal(detectLanguage({ country: 'VN' }), 'vi');
  assert.equal(detectLanguage({ country: 'LK' }), 'ta');
  assert.equal(detectLanguage({ country: 'TH' }), 'th');
  assert.equal(detectLanguage({ country: 'IT' }), 'it');
  assert.equal(detectLanguage({ country: 'my' }), 'ms');
  assert.equal(detectLanguage({ country: 'PT' }), 'pt-PT');
  assert.equal(detectLanguage({ country: 'IL' }), 'he');
  assert.equal(detectLanguage({ country: 'PH' }), 'fil');
  assert.equal(detectLanguage({ navigatorLanguages: ['pt-PT'] }), 'pt-PT');
});

test('the language list covers the major world languages and rtl scripts', () => {
  assert.ok(LANGUAGES.length >= 40, `expected at least 40 languages, got ${LANGUAGES.length}`);
  for (const code of ['ar', 'he', 'ur', 'fa', 'ps']) {
    assert.equal(isRtl(code), true, code);
  }
  assert.equal(catalogs.en.landing.hero.title, 'Learn your way. Go further with AI.');
  assert.equal(catalogs.ms.landing.hero.title, 'Belajar dengan cara anda. Pergi lebih jauh dengan AI.');
  assert.equal(catalogs.ar.landing.hero.title, 'تعلّم بطريقتك. امضِ أبعد مع الذكاء الاصطناعي.');
  assert.equal(catalogs.en.landing.degrees.title, 'Beyond A-Level.');
  assert.equal(catalogs.en.landing.newFeatures.label, 'New features');
  assert.equal(catalogs.en.landing.pricing.igcse7, 'ET AI Essay Writer — AI-graded 9-1 / A*-U');
  assert.equal(catalogs.en.landing.pricing.professional9, 'ET AI Live add-on');
  assert.equal(catalogs.en.landing.degrees.lineup, 'LLB Law, MBBS Medicine, Engineering and Nursing');
  assert.equal(catalogs.en.landing.supplement.title, 'We supplement. We do not replace.');
  assert.equal(
    catalogs.en.footer.disclaimer,
    'Poket School is not affiliated with, endorsed by, or accredited by Cambridge Assessment International Education (CAIE), Pearson Edexcel, Oxford AQA, the University of London, or any other examination board or government body. Curriculum references are for alignment and supplementary learning purposes only. Platform certificates are not official academic qualifications.',
  );
  assert.equal(catalogs.en.footer.rights, '© {{year}} Poket Media Sdn Bhd (1332289-X) · Made in Malaysia');
  assert.equal(catalogs.ar.footer.rights, catalogs.en.footer.rights);
  assert.equal(catalogs.en.auth.line2.includes('Pocket'), false);
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
  const authored = resolveLessonCopy({
    title: 'Cells',
    contentSources: [{ type: 'text', value: 'From the manuscript' }],
  }, 'en');
  assert.equal(authored.text, 'From the manuscript');
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
    'suggest.switch': ['{{language}}'],
    'footer.rights': ['{{year}}'],
    'market.related': ['{{title}}'],
    'market.freeLessons': ['{{count}}'],
    'market.hours': ['{{count}}'],
    'market.approx': ['{{amount}}'],
    'signup.consentSubtitle': ['{{email}}'],
    'signup.verifySubtitle': ['{{email}}'],
    'signup.consentSent': ['{{name}}', '{{email}}'],
    'signup.consentSentToast': ['{{email}}'],
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
