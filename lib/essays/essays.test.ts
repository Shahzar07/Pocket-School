import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingForTeacher, ENGLISH_ESSAY_COACHING } from './coaching';
import { ESSAY_FLAG_MESSAGE, ESSAY_FLAG_STATUS } from './config';
import { gradesForPercent, markEssay, placeNotes } from './mark';
import * as markModule from './mark';
import {
  EXEMPLAR_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  differentQuestion,
  guardExemplar,
  guardPlan,
  isEssayShaped,
  planEssay,
  planForPolicy,
  sharesTopic,
} from './plan';
import { acceptGeneratedQuestion, generateEssayQuestion } from './questions';
import { gradeIfClear, planningAllowed, reviewSubmission } from './submit';
import { normalizeEssay, statusText } from './store';

const PROMPT = 'How far does the harbour change the letter?';

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
  assert.match(coaching ?? '', /Never write the student's essay/);
  assert.doesNotMatch(coaching ?? '', /lyra/i);
  assert.doesNotMatch(coaching ?? '', /Year\s+\d/);
});

test('ET Essays does not draft a full essay', () => {
  assert.equal('draftEssay' in markModule, false);
  assert.match(PLAN_SYSTEM_PROMPT, /never write the student's essay/i);
  assert.match(PLAN_SYSTEM_PROMPT, /never return full paragraphs/i);
  assert.match(EXEMPLAR_SYSTEM_PROMPT, /different question/i);
  assert.doesNotMatch(PLAN_SYSTEM_PROMPT, /lyra/i);
});

test('a plan stays short, and the exemplar answers a different question', () => {
  const plan = planEssay({ idea: 'a harbour that keeps a lost letter', prompt: PROMPT, level: 'igcse' });
  const joined = [...plan.brainstorm, ...plan.outline, plan.thesis].join('\n');
  assert.equal(isEssayShaped(joined), false);
  assert.equal(plan.thesis.includes('\n'), false);
  assert.notEqual(plan.exemplarQuestion, PROMPT);
  assert.equal(sharesTopic(PROMPT, plan.exemplarQuestion), false);
  assert.equal(sharesTopic(PROMPT, plan.exemplar), false);
  assert.ok(plan.exemplar.split(/\s+/).length <= 70);
  assert.equal(differentQuestion(PROMPT) === PROMPT, false);
  assert.doesNotMatch(joined + plan.exemplar, /lyra/i);
  assert.doesNotMatch(joined + plan.exemplar, /Year\s+\d/);
  assert.equal(planForPolicy({ planningEnabled: false }, { idea: 'rain', prompt: PROMPT, level: 'igcse' }), null);
  assert.equal(planningAllowed({ planningEnabled: false }), false);
});

test('a reply shaped like the essay is replaced by the plan', () => {
  const fallback = planEssay({ idea: 'the library', prompt: 'How does a library change a town?', level: 'igcse' });
  const paragraph = `${'word '.repeat(45).trim()}.`;
  const essay = [paragraph, paragraph, paragraph, paragraph].join('\n\n');
  assert.equal(isEssayShaped(essay), true);
  const guarded = guardPlan({
    brainstorm: [essay],
    outline: ['One example, then what it shows.'],
    thesis: 'The claim holds.',
    exemplarQuestion: PROMPT,
    exemplar: essay,
  }, fallback, PROMPT);
  assert.equal(guarded, fallback);
  assert.equal(guardExemplar(essay, PROMPT, fallback.exemplar), fallback.exemplar);
  assert.equal(
    guardExemplar('The harbour keeps the letter in the rain.', PROMPT, fallback.exemplar),
    fallback.exemplar,
  );
});

test('a shaped essay outscores a fragment', () => {
  const thin = markEssay({ body: 'It changes it.', prompt: PROMPT, level: 'igcse' });
  const full = markEssay({
    body: [
      'The harbour changes the letter because the rain finds the ink.',
      'However, the name can still be read when the page is lifted in time.',
      'For example, a child waits on the quay and learns the difference.',
      'Overall, the harbour changes the letter only when nobody lifts it.',
    ].join('\n\n'),
    prompt: PROMPT,
    level: 'igcse',
  });
  assert.ok(full.percent > thin.percent);
  assert.equal(full.rubric.map(item => item.criterion).join(','), 'content,structure,language,accuracy');
  assert.ok(full.fixNext.length >= 1);
  assert.match(full.summary, /ET AI/);
  assert.doesNotMatch(full.summary, /lyra/i);
  assert.doesNotMatch(full.summary, /Year\s+\d/);
});

test('a paste burst or machine-like prose withholds the grade', () => {
  const burst = reviewSubmission({
    body: 'A short note.',
    signals: { pasteEvents: 1, largeInsertChars: 250 },
    title: 'Harbour',
  });
  const mark = markEssay({ body: 'A short note.', prompt: PROMPT, level: 'igcse' });
  assert.equal(burst.flagged, true);
  assert.equal(burst.status, ESSAY_FLAG_STATUS);
  assert.match(burst.message, /appears AI-generated/);
  assert.equal(gradeIfClear(burst, mark), null);
  assert.doesNotMatch(burst.message, /cheat|plagiar/i);

  const even = reviewSubmission({
    body: 'The river keeps the bridge. The river keeps the road. The river keeps the town. The river keeps the people.',
    signals: { pasteEvents: 0, largeInsertChars: 0 },
  });
  assert.equal(even.flagged, true);
  assert.equal(even.status, 'Flagged – redo required');

  const typed = reviewSubmission({
    body: [
      'The harbour keeps the letter.',
      'Rain finds the ink and the name fades into a pale line that nobody can read from the quay at dusk.',
      'A child still waits.',
      'The change is the waiting, which is longer than the letter itself, and the town learns to look past the water.',
    ].join(' '),
    signals: { pasteEvents: 0, largeInsertChars: 0 },
  });
  const typedMark = markEssay({
    body: 'The harbour keeps the letter because the rain finds the ink.',
    prompt: PROMPT,
    level: 'igcse',
  });
  assert.equal(typed.flagged, false);
  assert.equal(typed.status, 'clear');
  assert.ok(gradeIfClear(typed, typedMark));
});

test('a teacher can release a flagged essay for marking', () => {
  const review = reviewSubmission({
    body: 'The river keeps the bridge. The river keeps the road. The river keeps the town. The river keeps the people.',
    signals: { pasteEvents: 1, largeInsertChars: 400 },
  });
  assert.equal(gradeIfClear(review, markEssay({ body: 'Held.', prompt: PROMPT, level: 'igcse' })), null);
  const released = markEssay({
    body: 'The harbour changes the letter because the rain finds the ink. Overall, the page is different.',
    prompt: PROMPT,
    level: 'igcse',
  });
  assert.ok(released.percent >= 0);
  assert.match(released.summary, /ET AI/);
  const stored = normalizeEssay({
    id: 'essay-1',
    title: 'Harbour',
    body: 'Held.',
    mark: released,
    status: 'flagged',
    assist: [{ at: 1, kind: 'flag', note: ESSAY_FLAG_MESSAGE }],
  });
  assert.equal(stored?.mark, null);
  assert.equal(stored ? statusText(stored) : '', ESSAY_FLAG_STATUS);
  const after = normalizeEssay({ ...stored, status: 'released', mark: released });
  assert.equal(after?.mark?.percent, released.percent);
  assert.match(after ? statusText(after) : '', /%/);
});

test('a mark always has a 9–1 grade, a letter from A* to U, and a percentage', () => {
  const letters = new Set(['A*', 'A', 'B', 'C', 'D', 'E', 'U']);
  const numbers = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  for (let percent = 0; percent <= 100; percent += 1) {
    const grades = gradesForPercent(percent);
    assert.equal(grades.percent, percent);
    assert.ok(numbers.has(grades.grade91));
    assert.ok(letters.has(grades.gradeAU));
  }
  assert.deepEqual(gradesForPercent(75), { percent: 75, grade91: '7', gradeAU: 'B' });
  assert.deepEqual(gradesForPercent(40), { percent: 40, grade91: '4', gradeAU: 'E' });
});

test('ET AI sets a fresh question with marks and a word count', () => {
  const seen = new Set<string>();
  for (let nonce = 0; nonce < 12; nonce += 1) {
    const question = generateEssayQuestion({
      subject: 'History',
      level: 'igcse',
      topics: ['trade', 'cities'],
      type: 'argumentative',
      board: 'cambridge',
      recent: [...seen],
      nonce,
    });
    assert.equal(seen.has(question.question), false);
    seen.add(question.question);
    assert.match(question.question, /trade/i);
    assert.match(question.guidance, /350–450 words/);
    assert.match(question.guidance, /marked out of 30/);
    assert.equal(question.marks, 30);
    assert.doesNotMatch(question.question, /Year\s+\d/);
    assert.doesNotMatch(question.question, /lyra/i);
    assert.doesNotMatch(question.guidance, /Year\s+\d/);
  }
  const repeated = generateEssayQuestion({
    subject: 'History',
    level: 'a-level',
    topics: ['trade'],
    type: 'discursive',
    board: 'none',
    recent: [...seen],
    nonce: 0,
  });
  assert.equal(acceptGeneratedQuestion(repeated.question, [repeated.question], 'Fallback question?'), 'Fallback question?');
  assert.equal(acceptGeneratedQuestion(`${'word '.repeat(70)}?`, [], 'Fallback question?'), 'Fallback question?');
  assert.equal(acceptGeneratedQuestion('Year 9: how far did trade change the city?', [], 'Fallback question?'), 'Fallback question?');
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
