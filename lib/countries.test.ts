import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ISO_COUNTRIES,
  ISO_COUNTRY_COUNT,
  countryName,
  dialCode,
  flagEmoji,
  parseGeoCountry,
  resolveCountryCode,
  searchCountries,
  toE164,
} from './countries';

test('the shared list is the full ISO 3166-1 alpha-2 set', () => {
  assert.equal(ISO_COUNTRY_COUNT, 249);
  assert.equal(new Set(ISO_COUNTRIES.map((row) => row.code)).size, 249);
  for (const row of ISO_COUNTRIES) {
    assert.match(row.code, /^[A-Z]{2}$/);
    assert.match(row.dial, /^\d{1,4}$/);
  }
  assert.equal(dialCode('MY'), '60');
  assert.equal(dialCode('US'), '1');
  assert.equal(dialCode('GB'), '44');
});

test('names come from Intl.DisplayNames and flags are regional indicators', () => {
  assert.equal(countryName('MY', 'en'), 'Malaysia');
  assert.equal(countryName('DE', 'de'), 'Deutschland');
  assert.equal(flagEmoji('MY'), '🇲🇾');
  assert.equal(flagEmoji('nope'), '');
  assert.equal(resolveCountryCode('malaysia'), 'MY');
  assert.equal(resolveCountryCode('sg'), 'SG');
});

test('search, geo cookie, and phone numbers share the same list', () => {
  const found = searchCountries('malay', 'en');
  assert.equal(found.some((row) => row.code === 'MY'), true);
  assert.equal(parseGeoCountry('poket-geo-country=my'), 'MY');
  assert.equal(parseGeoCountry('other=1; poket-geo-country=ZZ'), '');
  assert.equal(toE164('MY', '0123456789'), '+60123456789');
});
