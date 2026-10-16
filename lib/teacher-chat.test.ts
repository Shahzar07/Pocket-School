import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractBoardItems, transcriptText } from './teacher-chat';

test('a quiz block becomes a board item and leaves the prose', () => {
  let n = 0;
  const { prose, items } = extractBoardItems(
    'Try this.\n```QUIZ\n{"question":"2+2","options":["3","4"],"answer":"4"}\n```\nWell done.',
    () => ++n,
  );
  assert.equal(prose.includes('Try this.'), true);
  assert.equal(prose.includes('QUIZ'), false);
  assert.equal(items[0]?.kind, 'quiz');
  if (items[0]?.kind === 'quiz') assert.equal(items[0].answer, '4');
});

test('a broken block stays in the transcript', () => {
  const { prose, items } = extractBoardItems('```QUIZ\n{not json}\n```', () => 1);
  assert.equal(items.length, 0);
  assert.equal(prose.includes('QUIZ'), true);
  assert.equal(transcriptText('ET Maths', [{ role: 'user', text: 'Hi' }]).startsWith('Student:'), true);
});
