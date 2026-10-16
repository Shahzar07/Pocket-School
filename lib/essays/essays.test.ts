import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingForTeacher, ENGLISH_ESSAY_COACHING } from './coaching';
import { draftEssay, gradesForPercent, markEssay, placeNotes } from './mark';

test('grades use 9–1 and A*–U from the same percentage', () => {
  assert.deepEqual(
    { a: gradesForPercent(92), b: gradesForPercent(55), c: gradesForPercent(10) },
    {
      a: { percent: 92, grade91: '9', gradeAU: 'A*' },
      b: { percent: 55, grade91: '5', gradeAU: 'D' },
      c: { percent: 10, grade91: '1', gradeAU: 'U' },
    },
  );
});

test('ET English coaching is shared and does not invent a year or another name', () => {
  const coaching = coachingForTeacher('et-english');
  assert.equal(coaching, ENGLISH_ESSAY_COACHING);
  assert.equal(coachingForTeacher('et-english-sl'), ENGLISH_ESSAY_COACHING);
  assert.equal(coachingForTeacher('et-maths'), null);
  assert.match(coaching ?? '', /topic sentence/);
  assert.match(coaching ?? '', /ET AI/);
  assert.doesNotMatch(coaching ?? '', /lyra/i);
  assert.doesNotMatch(coaching ?? '', /Year\s+\d/);
});

test('a shaped essay outscores a fragment, and the draft stays inside the brand', () => {
  const prompt = 'How far does the harbour change the letter?';
  const thin = markEssay({ body: 'It changes it.', prompt, level: 'igcse' });
  const draft = draftEssay({ idea: 'a harbour that keeps a lost letter', prompt, level: 'igcse' });
  const full = markEssay({ body: draft.body, prompt, level: 'igcse' });
  assert.ok(full.percent > thin.percent);
  assert.equal(full.rubric.map(item => item.criterion).join(','), 'content,structure,language,accuracy');
  assert.ok(full.fixNext.length >= 1);
  assert.match(draft.body, /Although/);
  assert.match(draft.body, /Overall/);
  assert.doesNotMatch(draft.body, /lyra/i);
  assert.doesNotMatch(draft.body, /Year\s+\d/);
  assert.match(full.summary, /ET AI/);
});

test('inline notes point at the words to change', () => {
  const mark = markEssay({
    body: 'The letter is definately still in the harbour. The letter is the letter and the letter is the letter.',
    prompt: 'Explain the letter.',
    level: 'lower-secondary',
  });
  assert.ok(mark.inline.some(note => note.quote.toLowerCase() === 'definately'));
  const placed = placeNotes(
    'The letter is definately still there.',
    [{ quote: 'definately', suggestion: 'Change this to “definitely”.' }],
  );
  assert.ok(placed.some(part => part.suggestion && part.text === 'definately'));
});
