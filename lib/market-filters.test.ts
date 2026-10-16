import assert from 'node:assert/strict';
import test from 'node:test';
import { filterResources, filterTutors } from './market-filters';

test('tutor and store search stay on the visible rows', () => {
  const tutors = filterTutors([
    { name: 'Amina', bio: 'Algebra', subjects: ['Maths'] },
    { name: 'Leo', bio: 'Essays', subjects: ['English'] },
  ], 'math');
  assert.equal(tutors.length, 1);
  const resources = filterResources([
    { title: 'Fractions sheet', kind: 'worksheet', status: 'approved' },
    { title: 'Poem notes', kind: 'note', status: 'draft' },
  ], 'poem', 'all');
  assert.equal(resources[0]?.kind, 'note');
  assert.equal(filterResources(resources, '', 'worksheet').length, 0);
});
