import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogs, hasUiCatalog, UI_LANGUAGE_CODES } from './catalog';
import { detectLanguage, formatAppDate, formatAppNumber, resolveLessonCopy } from './detect';

function flatKeys(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flatKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

test('ui catalogs share the english key set', () => {
  const english = flatKeys(catalogs.en).sort();
  for (const code of UI_LANGUAGE_CODES) {
    assert.deepEqual(flatKeys(catalogs[code]).sort(), english, code);
    assert.equal(hasUiCatalog(code), true);
  }
  assert.equal(hasUiCatalog('ar'), false);
  assert.equal(hasUiCatalog('id'), false);
});

test('browser language wins over a regional timezone', () => {
  assert.equal(detectLanguage(['en-MY'], 'Asia/Kuala_Lumpur'), 'en');
  assert.equal(detectLanguage(['ms-MY'], 'Asia/Shanghai'), 'ms');
  assert.equal(detectLanguage(['zh-CN'], 'Asia/Kuala_Lumpur'), 'zh');
  assert.equal(detectLanguage(['zh-Hans'], undefined), 'zh');
  assert.equal(detectLanguage(['ta-IN'], 'Asia/Kuala_Lumpur'), 'ta');
  assert.equal(detectLanguage(['fr-FR'], 'Asia/Kuala_Lumpur'), 'fr');
});

test('timezone is used only when the browser language is not supported', () => {
  assert.equal(detectLanguage(['xx'], 'Asia/Kuala_Lumpur'), 'ms');
  assert.equal(detectLanguage(['xx'], 'Asia/Kuching'), 'ms');
  assert.equal(detectLanguage([], 'Asia/Shanghai'), 'zh');
  assert.equal(detectLanguage(undefined, 'Asia/Colombo'), 'ta');
  assert.equal(detectLanguage(['en-US'], 'Asia/Colombo'), 'en');
  assert.equal(detectLanguage([], 'Europe/London'), 'en');
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

test('date and number formatters accept the interface locales and rtl', () => {
  const when = new Date('2026-10-15T00:00:00Z');
  for (const code of ['en', 'ms', 'zh', 'ta', 'ar']) {
    assert.equal(typeof formatAppDate(when, code), 'string');
    assert.ok(formatAppDate(when, code).length > 0);
    assert.equal(typeof formatAppNumber(1234.5, code), 'string');
  }
});
