import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { answersMatch, optionId, shuffle, shuffleQuizOptions } from './quiz';

describe('shuffle', () => {
  it('returns every item and does not edit the original', () => {
    const original = ['A', 'B', 'C', 'D'];
    const result = shuffle(original, () => 0);
    assert.deepEqual(result, ['B', 'C', 'D', 'A']);
    assert.deepEqual(original, ['A', 'B', 'C', 'D']);
  });

  it('is not stuck on the first option', () => {
    let n = 0;
    const rng = () => {
      n += 1;
      return n % 2 === 0 ? 0 : 0.99;
    };
    const result = shuffleQuizOptions(
      [{ question: 'Q', options: ['one', 'two', 'three', 'four'] }],
      rng,
    );
    assert.notEqual(result[0]?.options[0], 'one');
    assert.deepEqual(result[0]?.options.slice().sort(), ['four', 'one', 'three', 'two']);
  });
});

describe('answersMatch', () => {
  it('grades the option text after a shuffle', () => {
    const options = ['plants digest food', 'plants photosynthesize', 'animals photosynthesize', 'both the same'];
    assert.equal(answersMatch('plants photosynthesize', 'plants photosynthesize', options), true);
    assert.equal(answersMatch('plants digest food', 'plants photosynthesize', options), false);
  });

  it('still accepts a legacy letter answer against the original order', () => {
    const options = ['wrong', 'right', 'also wrong', 'nope'];
    assert.equal(answersMatch('right', 'B', options), true);
    assert.equal(answersMatch('wrong', 'B', options), false);
  });

  it('grades a translated label by the option id', () => {
    const english = ['plants digest food', 'plants photosynthesize'];
    assert.equal(answersMatch(optionId(1), 'plants photosynthesize', english), true);
    assert.equal(answersMatch(optionId(0), 'B', english), false);
    assert.equal(answersMatch('tumbuhan berfotosintesis', 'plants photosynthesize', english), false);
  });
});
