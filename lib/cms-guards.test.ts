import { describe, expect, it } from 'vitest';
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
    expect(quota).toMatch(/Blaze plan/);
    expect(quota).toMatch(/ringed-sentinel-436615-c2/);
    expect(describeFirestoreError(new Error('Lesson title is required'))).toBe('Lesson title is required');
  });

  it('escapes currency dollars and keeps real maths', () => {
    const escaped = escapeCurrencyDollars('Pay US$50 or NZ$20, not $E = mc^2$.');
    expect(escaped).toContain('US\\$50');
    expect(escaped).toContain('NZ\\$20');
    expect(escaped).toContain('$E = mc^2$');
  });

  it('does not eat the t in a LaTeX command', () => {
    expect(repairLiteralEscapes('Use \\theta and \\times.\\nNext')).toBe('Use \\theta and \\times.\nNext');
  });

  it('repairs café when UTF-8 was read as Latin-1', () => {
    expect(repairMojibake('cafÃ©')).toBe('café');
    expect(repairMojibake('café')).toBe('café');
  });

  it('adds the unit prefix only once', () => {
    expect(displayUnitTitle(1, 'Unit 1: Business activity')).toBe('Unit 1: Business activity');
    expect(displayUnitTitle(2, 'People in business')).toBe('Unit 2: People in business');
  });

  it('drops a quiz question with no single correct option and can append', () => {
    const good = { question: 'Why?', options: ['A reason', 'No'], answer: 'A reason' };
    const bad = { question: 'Missing', options: ['One', 'Two'], answer: '' };
    expect(questionsWithSingleAnswer([good, bad])).toEqual([good]);
    const more = { question: 'Next?', options: ['Yes', 'No'], answer: 'Yes' };
    expect(appendQuiz([good], [good, more])).toHaveLength(2);
    expect(countQuizQuestions([good, { question: '  ', options: [], answer: '' }])).toBe(1);
  });

  it('copies vocabulary aside before a glossary overwrite', () => {
    const next = applyGlossaryResult(
      { glossary: [{ term: 'Revenue', definition: 'Income' }] },
      [{ term: 'revenue', definition: 'money in' }],
    );
    expect(next.vocabulary[0].term).toBe('Revenue');
    expect(next.glossary[0].term).toBe('revenue');
  });

  it('patches one AI format without sending the lesson text again', () => {
    const patch = lessonFieldPatch(
      { title: 'L1', aiOutputs: { text: 'Body', quiz: [] } },
      { title: 'L1', aiOutputs: { text: 'Body', quiz: [{ question: 'Q' }] } },
    );
    expect(patch).toEqual({ 'aiOutputs.quiz': [{ question: 'Q' }] });
    expect(patch['aiOutputs.text']).toBeUndefined();
  });

  it('splits image placeholders out of the lesson body', () => {
    const parts = splitImageSlots('Intro\n\n[Image 1: after this paragraph]\n\nEnd');
    expect(parts.map((p) => p.type)).toEqual(['text', 'image', 'text']);
    expect(parts[1]).toMatchObject({ n: 1, caption: 'after this paragraph' });
  });

  it('strips stray CJK from an English quiz and flags invented statistics', () => {
    const cleaned = stripStrayCjkFromQuiz(
      [{ question: 'What is revenue?', options: ['Income 休', 'Costs'], answer: 'Income 休' }],
      'Revenue is income.',
    );
    expect(cleaned[0].options[0]).toBe('Income');
    expect(cleaned[0].answer).toBe('Income');
    expect(inventedNumbers('The firm employs 12 people.', '80% of jobs are private and 12 stay.')).toEqual(['80%']);
  });

  it('counts a scene plan and ignores a passing mention', () => {
    const brief = 'Scene 1 — hook\nScene 2 — costs\nScene 3 — revenue';
    expect(plannedSceneCount(brief)).toBe(3);
    expect(plannedSceneCount('Mention scene 1 only in passing')).toBeNull();
  });
});
