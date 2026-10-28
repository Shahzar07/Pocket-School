import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('importing auth and the user store does not open Firestore', () => {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx',
    '--input-type=module',
    '-e',
    `import { firestoreConnectionStarted } from './lib/firebase.ts';
     import './hooks/use-auth.ts';
     import './lib/db.ts';
     if (firestoreConnectionStarted()) process.exit(2);`,
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
