import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hardcodedUiStrings } from './hardcoded-ui';

const BASELINE = new URL('./hardcoded-ui.baseline.txt', import.meta.url);

test('new hardcoded user-facing strings fail CI', () => {
  const root = new URL('../../', import.meta.url);
  const found = hardcodedUiStrings(root.pathname);
  const allowed = new Set(
    readFileSync(BASELINE, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean),
  );
  const added = found.filter((line) => !allowed.has(line));
  assert.deepEqual(added, [], `New hardcoded UI strings:\n${added.join('\n')}`);
});
