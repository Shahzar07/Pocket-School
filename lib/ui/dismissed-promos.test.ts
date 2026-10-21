import assert from 'node:assert/strict';
import test from 'node:test';
import { dismissPromo, dismissedPromoCodes, isPromoDismissed } from './dismissed-promos';

test('a dismissed promo stays dismissed', () => {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
  assert.equal(isPromoDismissed('WELCOME'), false);
  dismissPromo('WELCOME');
  assert.deepEqual(dismissedPromoCodes(), ['WELCOME']);
  assert.equal(isPromoDismissed('WELCOME'), true);
  dismissPromo('WELCOME');
  assert.deepEqual(dismissedPromoCodes(), ['WELCOME']);
});
