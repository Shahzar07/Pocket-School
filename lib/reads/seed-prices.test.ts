import assert from 'node:assert/strict';
import test from 'node:test';
import { seedPricing, snapToStorePricePoint } from '@/lib/pricing';
import { storedBookPriceRM } from '@/lib/platform/pricing';
import { BOOKS } from './seed';

test('every seeded paid price is a valid store point', () => {
  const paid = BOOKS.filter(book => book.priceUsd > 0);
  assert.ok(paid.length >= 5);
  for (const book of paid) {
    assert.equal(snapToStorePricePoint(book.priceUsd), book.priceUsd, book.id);
    assert.equal(book.priceRM, storedBookPriceRM(book.priceUsd), book.id);
  }
  for (const book of BOOKS.filter(item => item.priceUsd === 0)) {
    assert.equal(book.priceRM, 0, book.id);
  }
  const price = (id: string) => BOOKS.find(book => book.id === id)?.priceUsd;
  assert.equal(price('harbour-light'), seedPricing().defaultBookUsd);
  assert.equal(price('harbour-light'), 1.99);
  assert.equal(price('cells-to-systems'), 7.99);
  assert.equal(price('malacca'), 3.99);
  assert.equal(price('plain-contract'), 9.99);
  assert.equal(price('monsoon-market'), 4.99);
  assert.equal(price('blue-notebook'), 0);
  assert.equal(price('yellow-window'), 0);
});
