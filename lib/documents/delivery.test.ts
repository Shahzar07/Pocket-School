import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAddresses, recipientList, smtpConfigured, SMTP_MISSING } from './delivery';

test('addresses, holders, and SMTP stay explicit', () => {
  assert.equal(smtpConfigured({ host: 'smtp.gmail.com', user: 'a', pass: 'b' }), true);
  assert.equal(smtpConfigured({ host: 'smtp.gmail.com', user: 'a' }), false);
  const parsed = parseAddresses('Amina@school.test, amina@school.test; finance@school.test');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.emails, ['amina@school.test', 'finance@school.test']);
  assert.equal(parseAddresses('not-an-email').ok, false);
  assert.deepEqual(recipientList(['Holder@school.test', ''], true, ['finance@school.test']), ['holder@school.test', 'finance@school.test']);
  assert.deepEqual(recipientList(['holder@school.test'], false, []), []);
  assert.match(SMTP_MISSING, /Download PDF still works/);
});
