import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearFallbackSession, readFallbackSession, saveFallbackSession } from './admin-mfa-fallback-session';

test('fallback session keeps the admin id and email and never a password', () => {
  const store = new Map<string, string>();
  const previous = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
      },
    },
  });
  try {
    assert.equal(readFallbackSession(), null);
    saveFallbackSession({ uid: 'uid-1', email: 'Harry.Seggu@gmail.com' });
    assert.deepEqual(readFallbackSession(), { uid: 'uid-1', email: 'harry.seggu@gmail.com' });
    const raw = [...store.values()][0] ?? '';
    assert.equal(raw.includes('password'), false);
    clearFallbackSession();
    assert.equal(readFallbackSession(), null);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previous });
  }
});
