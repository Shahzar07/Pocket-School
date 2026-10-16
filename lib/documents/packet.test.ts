import assert from 'node:assert/strict';
import test from 'node:test';
import { billingDocument, documentPdf, rowsToCsv, textDocument } from './packet';

test('branded packet and csv', () => {
  const doc = textDocument({ id: 'r1', title: 'Report', lines: ['Study time: 40'] });
  assert.equal(doc.lines[0], 'Poket School');
  assert.equal(doc.filename, 'poket-Report.pdf');
  assert.equal(documentPdf(doc, 2026)[0], 0x25);
  const invoice = billingDocument({ id: 'inv 1', description: 'Term fee', totalLabel: 'RM 10', status: 'sent', studentName: 'Amina' });
  assert.match(invoice.filename, /^poket-invoice-inv1\.pdf$/);
  assert.match(invoice.lines.join('\n'), /Amina/);
  assert.equal(rowsToCsv(['Name'], [['Ada "A"']]), '"Name"\n"Ada ""A"""');
});
