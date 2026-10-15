import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/admin/console/route';

test('the admin console rejects a request with no sign-in token', async () => {
  const response = await POST(new Request('http://localhost/api/admin/console', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync-claims' }),
  }));
  assert.equal(response.status, 401);
  const body = await response.json() as { error?: string };
  assert.match(body.error ?? '', /Sign in again/);
});

test('view-as requests are refused before any admin write', async () => {
  const response = await POST(new Request('http://localhost/api/admin/console', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer not-a-real-token',
      'x-poket-view-as': '1',
    },
    body: JSON.stringify({ action: 'set-role' }),
  }));
  assert.equal(response.status, 401);
});
