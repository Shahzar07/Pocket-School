import assert from 'node:assert/strict';
import test from 'node:test';
import { countByRole } from './access-counts';

test('role counts keep every audience and fold unknown roles into students', () => {
  const counts = countByRole([
    { role: 'student' },
    { role: 'teacher' },
    { role: 'teacher' },
    { role: 'parent' },
    { role: 'institution_admin' },
    { role: 'admin' },
    { role: 'mystery' },
    {},
  ]);
  assert.deepEqual(counts, [
    { role: 'student', count: 3 },
    { role: 'teacher', count: 2 },
    { role: 'parent', count: 1 },
    { role: 'institution_admin', count: 1 },
    { role: 'admin', count: 1 },
  ]);
});
