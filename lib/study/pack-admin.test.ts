import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PACKS } from './exam-packs';
import { deletePack, listPacks, savePack, EMPTY_PACK_STORE } from './pack-admin';

test('an admin can add, edit, and delete an exam pack', () => {
  const added = savePack(EMPTY_PACK_STORE, {
    id: 'school-stats',
    name: 'School statistics pack',
    board: 'School syllabus',
    level: 'IGCSE',
    scale: 'igcse',
    blurb: 'A school-written statistics pack.',
    accent: '#1E6A83',
    units: [{ id: 's', title: 'Statistics', topics: [{ id: 's-1', title: 'Averages', weight: 3 }] }],
  });
  assert.equal(listPacks(added).some((pack) => pack.id === 'school-stats'), true);
  const edited = savePack(added, { ...added.packs[0]!, name: 'Statistics workshop' });
  assert.equal(listPacks(edited).find((pack) => pack.id === 'school-stats')?.name, 'Statistics workshop');
  const removed = deletePack(edited, 'spm-math');
  assert.equal(listPacks(removed).some((pack) => pack.id === 'spm-math'), false);
  assert.equal(listPacks(removed).length, EXAM_PACKS.length);
});
