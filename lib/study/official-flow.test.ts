import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PACKS } from './exam-packs';
import {
  definedPapers,
  estimateFor,
  flowKeyTarget,
  hintSteps,
  markParts,
  mockQuestions,
  revisionPlan,
  studentCrumbHref,
  topicLocked,
  weakQuestions,
} from './official-flow';

test('the trail links completed steps and leaves the rest closed', () => {
  assert.equal(studentCrumbHref('level', { level: '', board: '', subject: '' }), '/dashboard/studio/exams/packs');
  assert.equal(studentCrumbHref('board', { level: 'igcse', board: '', subject: '' }), '/dashboard/studio/exams/packs/board/igcse');
  assert.equal(studentCrumbHref('subject', { level: '', board: 'spm', subject: '' }), null);
  assert.equal(
    studentCrumbHref('pack', { level: 'igcse', board: 'spm', subject: 'Mathematics' }),
    '/dashboard/studio/exams/packs/browse/igcse/spm/mathematics',
  );
  assert.equal(studentCrumbHref('practice', { level: 'igcse', board: 'spm', subject: 'Mathematics', packId: 'spm-math' }), null);
});

test('hints never include the final answer', () => {
  const steps = hintSteps({
    solution: 'Write the first step.\nMultiply both sides.\nThe answer is 4.',
    answer: '4',
  });
  assert.equal(steps.some((step) => step.includes('4')), false);
  assert.equal(steps[0], 'Write the first step.');
  const fallback = hintSteps({ solution: '4', answer: '4' });
  assert.equal(fallback.some((step) => step.includes('4')), false);
});

test('mark parts appear only when the scheme names them', () => {
  assert.deepEqual(markParts('M1 method. A1 accuracy.'), ['method', 'accuracy']);
  assert.equal(markParts('Award the marks you can see.'), null);
  assert.equal(markParts(''), null);
});

test('a mock uses paper names from the pack and invents none', () => {
  const questions = [
    { paper: 'Section A', n: 1 },
    { paper: 'Section A', n: 2 },
    { paper: 'Section B', n: 3 },
    { paper: '', n: 4 },
  ];
  assert.deepEqual(definedPapers(questions), ['Section A', 'Section B']);
  assert.deepEqual(mockQuestions(questions, 'full').papers, ['Section A', 'Section B']);
  assert.deepEqual(mockQuestions(questions, 'half').questions.map((item) => item.n), [1, 2]);
  assert.deepEqual(mockQuestions([{ paper: '' }], 'full'), { defined: false, papers: [], questions: [] });
  const one = mockQuestions([{ paper: 'Section A', n: 1 }, { paper: 'Section A', n: 2 }], 'half');
  assert.deepEqual(one.questions.map((item) => item.n), [1]);
  assert.equal(one.papers.includes('Paper 1'), false);
});

test('the first topic is free and later topics stay locked', () => {
  const pack = EXAM_PACKS[0]!;
  const first = pack.units[0]!.topics[0]!.id;
  const second = pack.units[0]!.topics[1]!.id;
  assert.equal(topicLocked(pack, first), false);
  assert.equal(topicLocked(pack, second), true);
});

test('an estimate is labelled as ET AI and the plan follows the exam date', () => {
  assert.equal(estimateFor('igcse', 80).label, 'ET AI estimate');
  assert.equal(estimateFor('igcse', 80).grade.length > 0, true);
  const plan = revisionPlan(
    [{ id: 'a', title: 'Algebra' }, { id: 'b', title: 'Graphs' }],
    { a: 20, b: 90 },
    '2026-10-23',
    '2026-10-21',
  );
  assert.deepEqual(plan.map((row) => row.title), ['Algebra', 'Graphs', 'Algebra']);
  assert.equal(revisionPlan([{ id: 'a', title: 'Algebra' }], {}, '', '2026-10-21').length, 0);
});

test('weak questions are the ones below full marks, and arrow keys skip fields', () => {
  assert.equal(weakQuestions([{ marks: 4 }, { marks: 2 }], [4, 1]).length, 1);
  const typing = { key: 'ArrowRight', altKey: false, metaKey: false, ctrlKey: false, target: { tagName: 'TEXTAREA' } };
  assert.equal(flowKeyTarget(typing, 3, 0), null);
  const plain = { key: 'ArrowLeft', altKey: false, metaKey: false, ctrlKey: false, target: { tagName: 'DIV' } };
  assert.equal(flowKeyTarget(plain, 3, 0), null);
  assert.equal(flowKeyTarget({ ...plain, key: 'ArrowRight' }, 3, 0), 1);
});
