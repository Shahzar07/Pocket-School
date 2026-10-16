import assert from 'node:assert/strict';
import test from 'node:test';
import { SMTP_PRESETS, smtpPreset } from './smtp-presets';

test('mail presets cover the providers an admin can pick', () => {
  const ids = SMTP_PRESETS.map((preset) => preset.id);
  assert.deepEqual(ids, ['gmail', 'sendgrid', 'mailgun', 'ses', 'resend']);
  assert.equal(smtpPreset('sendgrid')?.host, 'smtp.sendgrid.net');
  assert.equal(smtpPreset('missing'), null);
  for (const preset of SMTP_PRESETS) {
    assert.match(preset.port, /^\d+$/);
    assert.ok(preset.host.includes('.'));
  }
});
