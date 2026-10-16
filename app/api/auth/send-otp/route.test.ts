import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from './route';

const KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'OTP_SECRET', 'SUPER_ADMIN_EMAILS'] as const;

function withoutEmailService(): () => void {
  const saved = new Map<string, string | undefined>();
  for (const key of KEYS) saved.set(key, process.env[key]);
  for (const key of KEYS) delete process.env[key];
  return () => {
    for (const key of KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('send-otp reports SMTP missing and does not offer a second factor without a sign-in token', async () => {
  const restore = withoutEmailService();
  try {
    process.env.SUPER_ADMIN_EMAILS = 'harry.seggu@gmail.com';
    const response = await POST(new Request('http://localhost/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'harry.seggu@gmail.com' }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json() as { configured?: boolean; code?: string; fallback?: unknown };
    assert.equal(body.configured, false);
    assert.equal(body.code, 'SMTP_NOT_CONFIGURED');
    assert.equal(body.fallback, undefined);
  } finally {
    restore();
  }
});

test('a token that does not verify does not unlock the super-admin fallback', async () => {
  const restore = withoutEmailService();
  try {
    process.env.SUPER_ADMIN_EMAILS = 'owner@example.com';
    const response = await POST(new Request('http://localhost/api/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer not-a-firebase-id-token',
      },
      body: JSON.stringify({ email: 'owner@example.com' }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json() as { configured?: boolean; fallback?: unknown };
    assert.equal(body.configured, false);
    assert.equal(body.fallback, undefined);
  } finally {
    restore();
  }
});
