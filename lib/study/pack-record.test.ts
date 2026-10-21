import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PACKS, isFreeTopic } from './exam-packs';
import { EMPTY_PACK_STORE } from './pack-admin';
import { mergeCatalog, normaliseRemotePack, planImport } from './pack-record';

const custom = {
  id: 'harbour-stats',
  name: 'Harbour statistics',
  board: 'School syllabus',
  level: 'IGCSE',
  scale: 'igcse' as const,
  blurb: 'A school-written statistics pack.',
  accent: '#C8820A',
  freeFirstTopic: true,
  units: [{
    id: 's',
    title: 'Statistics',
    topics: [{
      id: 's-1',
      title: 'Mean and range',
      weight: 3,
      questions: [
        { question: 'Find the mean of 2, 4 and 6.', marks: 2, solution: 'The mean is 4.', markScheme: 'M1 sum. A1 answer 4.', answer: '' },
        { question: '   ', marks: 1, solution: '', markScheme: '' },
      ],
    }],
  }],
};

test('published packs replace the seed and drafts stay off the student list', () => {
  const published = normaliseRemotePack({ ...custom, status: 'published' });
  const draft = normaliseRemotePack({ ...custom, id: 'draft-only', name: 'Draft only', status: 'draft' });
  assert.ok(published);
  assert.ok(draft);
  assert.equal(published.accent, '#1E6A83');
  assert.equal(published.units[0]?.topics[0]?.questions?.length, 1);
  const students = mergeCatalog([published, draft], { includeDrafts: false });
  const admins = mergeCatalog([published, draft], { includeDrafts: true });
  assert.equal(students.some(pack => pack.id === 'harbour-stats'), true);
  assert.equal(students.some(pack => pack.id === 'draft-only'), false);
  assert.equal(admins.some(pack => pack.id === 'draft-only'), true);
  assert.equal(students.length, EXAM_PACKS.length + 1);
});

test('hiding a built-in removes it, and a published edit replaces its name', () => {
  const hidden = normaliseRemotePack({ id: 'spm-math', name: 'spm-math', status: 'hidden', units: [] });
  const edited = normaliseRemotePack({
    ...EXAM_PACKS.find(pack => pack.id === 'igcse-0580'),
    name: 'IGCSE Mathematics workshop',
    status: 'published',
  });
  assert.ok(hidden);
  assert.ok(edited);
  const packs = mergeCatalog([hidden, edited], { includeDrafts: false });
  assert.equal(packs.some(pack => pack.id === 'spm-math'), false);
  assert.equal(packs.find(pack => pack.id === 'igcse-0580')?.name, 'IGCSE Mathematics workshop');
  assert.equal(packs.length, EXAM_PACKS.length - 1);
});

test('an empty remote catalogue falls back to the built-in packs', () => {
  assert.equal(mergeCatalog([], { includeDrafts: false }).length, EXAM_PACKS.length);
});

test('the free-first-topic toggle can turn the free topic off', () => {
  const pack = normaliseRemotePack({ ...custom, status: 'published', freeFirstTopic: false });
  assert.ok(pack);
  assert.equal(isFreeTopic(pack, 's-1'), false);
  assert.equal(isFreeTopic({ ...pack, freeFirstTopic: true }, 's-1'), true);
  assert.equal(isFreeTopic(EXAM_PACKS[0]!, EXAM_PACKS[0]!.units[0]!.topics[0]!.id), true);
});

test('a one-time import publishes local packs and hides removed built-ins once', () => {
  const writes = planImport(new Set(['harbour-stats']), {
    packs: [
      { ...custom, status: undefined },
      { ...custom, id: 'new-school', name: 'New school pack' },
    ],
    removed: ['spm-math', 'not-a-pack'],
  });
  assert.deepEqual(writes.map(pack => pack.id), ['new-school', 'spm-math']);
  assert.equal(writes[0]?.status, 'published');
  assert.equal(writes[1]?.status, 'hidden');
  assert.equal(planImport(new Set(), EMPTY_PACK_STORE).length, 0);
});

test('a pack without a topic is rejected', () => {
  assert.equal(normaliseRemotePack({ name: 'Empty', status: 'published', units: [] }), null);
});
