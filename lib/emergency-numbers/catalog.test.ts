import assert from 'node:assert/strict';
import test from 'node:test';
import { localAlertPush } from './copy';
import { SEEDED_EMERGENCY_NUMBERS, cleanEmergencyNumbers, mapsSearchUrl, numbersFor, sameCountry } from './catalog';

test('seeded numbers cite an https source and a review date', () => {
  for (const row of SEEDED_EMERGENCY_NUMBERS) {
    assert.equal(row.needsReview, false, row.countryCode);
    assert.match(row.sourceUrl, /^https:\/\//);
    assert.match(row.lastVerified, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.general);
    assert.ok(row.childHelpline);
    assert.ok(row.childAlertName);
    assert.match(row.childAlertUrl, /^https:\/\//);
  }
  assert.equal(numbersFor('Malaysia')?.general, '999');
  assert.equal(numbersFor('United States')?.mentalHealth, '988');
  assert.equal(numbersFor('UK')?.childAlertName, 'Child Rescue Alert');
  assert.equal(sameCountry('Malaysia', 'MY'), true);
  assert.equal(sameCountry('home', 'MY'), false);
});

test('an editor row without a source is marked for review', () => {
  const row = cleanEmergencyNumbers({ countryCode: 'SG', countryName: 'Singapore', general: '999', sourceUrl: '', lastVerified: '' });
  assert.equal(row?.needsReview, true);
  assert.equal(cleanEmergencyNumbers({ countryCode: '' }), null);
});

test('maps search stays on the free search URL and push copy falls back to English', () => {
  assert.equal(mapsSearchUrl('police station'), 'https://www.google.com/maps/search/?api=1&query=police%20station');
  assert.match(mapsSearchUrl('hospital', { lat: 3.1, lng: 101.7 }), /hospital%203\.10000%2C101\.70000/);
  assert.equal(localAlertPush('ms', 'missing_child').title, 'Kanak-kanak hilang');
  assert.equal(localAlertPush('zh-Hant', 'lockdown').body, '打开警报。');
  assert.equal(localAlertPush('ta', 'medical').title.length > 0, true);
  assert.equal(localAlertPush('fr', 'weather').title, 'Weather');
  assert.equal(localAlertPush('en', 'missing_child').body.includes('999'), false);
});
