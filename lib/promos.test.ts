import assert from 'node:assert/strict';
import test from 'node:test';
import { bannerCopy, conversionRate, parsePromo, promoLive, shortLink } from './promos';

test('a live promo keeps a quantity and a countdown', () => {
  const parsed = parsePromo({
    item: 'Primary maths',
    kind: 'course',
    percentOff: 20,
    quantityLimit: 40,
    expiresAt: '2026-12-01',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const promo = { ...parsed.promo, redeemed: 3, endsAt: parsed.promo.expiresAt, banner: true };
  assert.equal(promoLive(promo, '2026-10-16'), true);
  assert.match(bannerCopy(promo, '2026-10-16') ?? '', /20% off Primary maths/);
  assert.match(bannerCopy(promo, '2026-10-16') ?? '', /37 left/);
  assert.equal(bannerCopy({ ...promo, redeemed: 40 }, '2026-10-16'), null);
  assert.equal(shortLink('https://pocket-school-ochre.vercel.app/', 'AMINA12'), 'https://pocket-school-ochre.vercel.app/r/AMINA12');
  assert.equal(conversionRate(8, 2), 0.25);
  assert.equal(parsePromo({ item: '', percentOff: 10, quantityLimit: 1, expiresAt: '2026-12-01' }).ok, false);
});
