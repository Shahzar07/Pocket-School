import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendQuiz,
  applyGlossaryResult,
  countQuizQuestions,
  describeFirestoreError,
  displayUnitTitle,
  escapeCurrencyDollars,
  inventedNumbers,
  lessonFieldPatch,
  plannedSceneCount,
  questionsWithSingleAnswer,
  stripStrayCjkFromQuiz,
  repairLiteralEscapes,
  repairMojibake,
  splitImageSlots,
} from './cms-guards';

describe('cms guards', () => {
  it('names a write-quota failure and leaves other errors alone', () => {
    const quota = describeFirestoreError({ code: 'resource-exhausted', message: 'Quota exceeded' });
    assert.match(quota, /Blaze plan/);
    assert.match(quota, /ringed-sentinel-436615-c2/);
    assert.equal(describeFirestoreError(new Error('Lesson title is required')), 'Lesson title is required');
  });

  it('escapes currency dollars and keeps real maths', () => {
    const escaped = escapeCurrencyDollars('Pay US$50 or NZ$20, not $E = mc^2$.');
    assert.ok(escaped.includes('US\\$50'));
    assert.ok(escaped.includes('NZ\\$20'));
    assert.ok(escaped.includes('$E = mc^2$'));
  });

  it('does not eat the t in a LaTeX command', () => {
    assert.equal(repairLiteralEscapes('Use \\theta and \\times.\\nNext'), 'Use \\theta and \\times.\nNext');
  });

  it('repairs café when UTF-8 was read as Latin-1', () => {
    assert.equal(repairMojibake('cafÃ©'), 'café');
    assert.equal(repairMojibake('café'), 'café');
  });

  it('adds the unit prefix only once', () => {
    assert.equal(displayUnitTitle(1, 'Unit 1: Business activity'), 'Unit 1: Business activity');
    assert.equal(displayUnitTitle(2, 'People in business'), 'Unit 2: People in business');
  });

  it('drops a quiz question with no single correct option and can append', () => {
    const good = { question: 'Why?', options: ['A reason', 'No'], answer: 'A reason' };
    const bad = { question: 'Missing', options: ['One', 'Two'], answer: '' };
    assert.deepEqual(questionsWithSingleAnswer([good, bad]), [good]);
    const more = { question: 'Next?', options: ['Yes', 'No'], answer: 'Yes' };
    assert.equal(appendQuiz([good], [good, more]).length, 2);
    assert.equal(countQuizQuestions([good, { question: '  ', options: [], answer: '' }]), 1);
  });

  it('copies vocabulary aside before a glossary overwrite', () => {
    const next = applyGlossaryResult(
      { glossary: [{ term: 'Revenue', definition: 'Income' }] },
      [{ term: 'revenue', definition: 'money in' }],
    );
    assert.equal(next.vocabulary?.[0]?.term, 'Revenue');
    assert.equal(next.glossary?.[0]?.term, 'revenue');
  });

  it('patches one AI format without sending the lesson text again', () => {
    const patch = lessonFieldPatch(
      { title: 'L1', aiOutputs: { text: 'Body', quiz: [] } },
      { title: 'L1', aiOutputs: { text: 'Body', quiz: [{ question: 'Q' }] } },
    );
    assert.deepEqual(patch, { 'aiOutputs.quiz': [{ question: 'Q' }] });
    assert.equal('aiOutputs.text' in patch, false);
  });

  it('splits image placeholders out of the lesson body', () => {
    const parts = splitImageSlots('Intro\n\n[Image 1: after this paragraph]\n\nEnd');
    assert.deepEqual(parts.map((p) => p.type), ['text', 'image', 'text']);
    assert.deepEqual(parts[1], { type: 'image', n: 1, caption: 'after this paragraph' });
  });

  it('strips stray CJK from an English quiz and flags invented statistics', () => {
    const cleaned = stripStrayCjkFromQuiz(
      [{ question: 'What is revenue?', options: ['Income 休', 'Costs'], answer: 'Income 休' }],
      'Revenue is income.',
    );
    assert.equal(cleaned[0]?.options[0], 'Income');
    assert.equal(cleaned[0]?.answer, 'Income');
    assert.deepEqual(inventedNumbers('The firm employs 12 people.', '80% of jobs are private and 12 stay.'), ['80%']);
  });

  it('counts a scene plan and ignores a passing mention', () => {
    const brief = 'Scene 1 — hook\nScene 2 — costs\nScene 3 — revenue';
    assert.equal(plannedSceneCount(brief), 3);
    assert.equal(plannedSceneCount('Mention scene 1 only in passing'), null);
  });
});
