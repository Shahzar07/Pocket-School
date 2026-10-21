import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PACKS } from './exam-packs';
import { normaliseRemotePack, presentAuthored } from './pack-record';
import { filterPacks, officialSubjectOptions, packSubject, subjectSlug } from './pack-catalog';

test('the built-in packs are Mathematics and follow the shared level and board lists', () => {
  assert.equal(EXAM_PACKS.length, 6);
  assert.equal(EXAM_PACKS.every((pack) => pack.subject === 'Mathematics'), true);
  const maths = filterPacks(EXAM_PACKS, { subject: 'mathematics' });
  assert.equal(maths.length, 6);
  assert.deepEqual(
    filterPacks(EXAM_PACKS, { subject: 'mathematics', level: 'igcse', board: 'spm' }).map((pack) => pack.id),
    ['spm-math', 'spm-addmath'],
  );
  assert.deepEqual(
    filterPacks(EXAM_PACKS, { level: 'a-level' }).map((pack) => pack.id),
    ['alevel-9709'],
  );
  assert.deepEqual(filterPacks(EXAM_PACKS, { subject: 'science' }).map((pack) => pack.id), []);
  assert.equal(officialSubjectOptions().some((item) => item.slug === 'science'), true);
  assert.equal(officialSubjectOptions().some((item) => item.slug === 'english'), true);
  assert.equal(officialSubjectOptions().some((item) => item.slug === 'business'), true);
  assert.equal(subjectSlug(packSubject(EXAM_PACKS[0]!)), 'mathematics');
});

test('a saved pack keeps its subject, and questions keep LaTeX, images, and mark schemes', () => {
  const pack = normaliseRemotePack({
    id: 'science-cells',
    name: 'Cell structure',
    subject: 'Science',
    learnerLevel: 'igcse',
    boardStyle: 'cambridge-igcse',
    board: 'International',
    level: 'IGCSE',
    status: 'published',
    units: [{
      id: 'cells',
      title: 'Cells',
      topics: [{
        id: 'cell-1',
        title: 'Structure',
        weight: 3,
        questions: [{
          question: 'Label the nucleus in $x^2$.',
          marks: 2,
          solution: 'The nucleus is the dark body.',
          markScheme: '1 mark for the nucleus.',
          image: 'https://cdn.example.com/cell.png',
        }, {
          question: 'Skip this.',
          marks: 1,
          solution: 'No.',
          markScheme: 'No.',
          image: 'javascript:alert(1)',
        }],
      }],
    }],
  });
  assert.ok(pack);
  assert.equal(pack.subject, 'Science');
  assert.equal(pack.learnerLevel, 'igcse');
  assert.equal(filterPacks([pack], { subject: 'science' }).length, 1);
  const questions = presentAuthored(pack.units[0]!.topics[0]!);
  assert.equal(questions.length, 2);
  assert.equal(questions[0]?.question.includes('$x^2$'), true);
  assert.equal(questions[0]?.image, 'https://cdn.example.com/cell.png');
  assert.match(questions[0]?.solution ?? '', /Mark scheme/);
  assert.equal(questions[1]?.image, undefined);
});
