import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQuizTranslation, parseTrueFalseTranslation, quizPayload, trueFalsePayload } from './quiz-translation';

test('quiz labels follow the translation and the English answer stays', () => {
  const source = [
    { question: 'What is two?', options: ['1', '2'], answer: '2', explanation: 'Count.' },
  ];
  const raw = JSON.stringify([
    { question: 'Was ist zwei?', options: ['eins', 'zwei'], answer: 'eins', explanation: 'Zaehlen.' },
  ]);
  const parsed = parseQuizTranslation(raw, source);
  assert.equal(parsed?.[0]?.question, 'Was ist zwei?');
  assert.deepEqual(parsed?.[0]?.options, ['eins', 'zwei']);
  assert.equal(parsed?.[0]?.answer, '2');
  assert.equal(parseQuizTranslation('[]', source), null);
  assert.equal(quizPayload(source).includes('What is two?'), true);
});

test('true or false statements translate without moving the boolean answer', () => {
  const source = [{ statement: 'Ice floats.', answer: true, explanation: 'It is less dense.' }];
  const raw = trueFalsePayload([{ statement: 'Es flota.', explanation: 'Es menos denso.' }]);
  const parsed = parseTrueFalseTranslation(raw, source);
  assert.equal(parsed?.[0]?.statement, 'Es flota.');
  assert.equal(parsed?.[0]?.answer, true);
  assert.equal(parseTrueFalseTranslation('{"statement":"no"}', source), null);
});
