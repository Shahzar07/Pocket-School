import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceFilename, invoicePdfBytes, invoicePdfLines } from './invoice-pdf';

test('a Poket School invoice PDF names the school and the invoice', () => {
  const row = {
    id: 'chk_amina',
    title: 'Primary plan',
    status: 'paid',
    totalLabel: '$29.00',
    holderName: 'Amina',
    holderEmail: 'amina@school.test',
  };
  const lines = invoicePdfLines(row);
  assert.match(lines.join('\n'), /Poket School/);
  assert.match(lines.join('\n'), /Amina/);
  const pdf = invoicePdfBytes(row, 2026);
  const text = new TextDecoder().decode(pdf);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(invoiceFilename(row), /^INV-.*\.pdf$/);
});
