import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFinanceRows, invoiceLabel, PAYER_NOTE } from './billing-model';

test('finance search matches an invoice or a payer title', () => {
  const rows = [
    { id: 'a', title: 'Amina family', invoiceId: 'inv_1', status: 'paid' },
    { id: 'b', title: 'North School', status: 'open' },
  ];
  assert.equal(filterFinanceRows(rows, 'amina').length, 1);
  assert.equal(filterFinanceRows(rows, 'open')[0]?.id, 'b');
  assert.match(invoiceLabel(rows[0]!), /^INV-/);
  assert.match(PAYER_NOTE, /parent/);
  assert.match(PAYER_NOTE, /institution/);
});
