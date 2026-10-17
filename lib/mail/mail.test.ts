import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { mailMode } from './select';
import { sendWithBackoff } from './retry';
import { resendEventStatus, verifyResendSignature } from './webhook';
import type { MailEnv } from './types';

function env(overrides: Partial<MailEnv> = {}): MailEnv {
  return { NODE_ENV: 'development', ...overrides };
}

test('mail mode prefers Resend, then SMTP, then a dev console or a production failure', () => {
  assert.equal(mailMode(env({ RESEND_API_KEY: 're_test', SMTP_HOST: 'smtp.example', SMTP_USER: 'a', SMTP_PASS: 'b' })), 'resend');
  assert.equal(mailMode(env({ SMTP_HOST: 'smtp.example', SMTP_USER: 'a', SMTP_PASS: 'b' })), 'smtp');
  assert.equal(mailMode(env()), 'console');
  assert.equal(mailMode(env({ NODE_ENV: 'production' })), 'failed');
  assert.equal(mailMode(env({ NODE_ENV: 'production', RESEND_API_KEY: 're_test' })), 'resend');
});

test('sendWithBackoff retries on the configured delays and stops when a send succeeds', async () => {
  const waits: number[] = [];
  let calls = 0;
  const result = await sendWithBackoff(async () => {
    calls += 1;
    return { ok: calls === 3, error: calls === 3 ? '' : 'not yet' };
  }, async (ms) => {
    waits.push(ms);
  });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [400, 1600]);
  assert.equal(result.ok, true);

  let thrown = 0;
  const failed = await sendWithBackoff<{ ok: boolean; error: string }>(async () => {
    thrown += 1;
    throw new Error('down');
  }, async () => undefined);
  assert.equal(thrown, 3);
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'down');
});

test('a Resend webhook signature is accepted inside five minutes and maps delivery events', () => {
  const raw = Buffer.from('poket-school-webhook-key');
  const secret = `whsec_${raw.toString('base64')}`;
  const id = 'msg_1';
  const timestamp = '1700000000';
  const body = '{"type":"email.delivered","data":{"email_id":"email_1"}}';
  const signature = createHmac('sha256', raw).update(`${id}.${timestamp}.${body}`).digest('base64');
  const input = { secret, id, timestamp, signature: `v1,${signature}`, body, nowSeconds: 1700000000 };
  assert.equal(verifyResendSignature(input), true);
  assert.equal(verifyResendSignature({ ...input, nowSeconds: 1700000000 + 301 }), false);
  assert.equal(verifyResendSignature({ ...input, secret: '' }), false);
  assert.equal(resendEventStatus('email.delivered'), 'delivered');
  assert.equal(resendEventStatus('email.opened'), 'opened');
  assert.equal(resendEventStatus('email.bounced'), 'failed');
  assert.equal(resendEventStatus('email.complained'), 'failed');
  assert.equal(resendEventStatus('email.sent'), null);
});
