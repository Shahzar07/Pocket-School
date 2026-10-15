import { describe, expect, it } from 'vitest';
import { answersMatch, shuffle, shuffleQuizOptions } from './quiz';

describe('shuffle', () => {
  it('returns every item and does not edit the original', () => {
    const original = ['A', 'B', 'C', 'D'];
    const result = shuffle(original, () => 0);
    expect(result).toEqual(['B', 'C', 'D', 'A']);
    expect(original).toEqual(['A', 'B', 'C', 'D']);
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
    expect(result[0]?.options[0]).not.toBe('one');
    expect(result[0]?.options.slice().sort()).toEqual(['four', 'one', 'three', 'two']);
  });
});

describe('answersMatch', () => {
  it('grades the option text after a shuffle', () => {
    const options = ['plants digest food', 'plants photosynthesize', 'animals photosynthesize', 'both the same'];
    expect(answersMatch('plants photosynthesize', 'plants photosynthesize', options)).toBe(true);
    expect(answersMatch('plants digest food', 'plants photosynthesize', options)).toBe(false);
  });

  it('still accepts a legacy letter answer against the original order', () => {
    const options = ['wrong', 'right', 'also wrong', 'nope'];
    expect(answersMatch('right', 'B', options)).toBe(true);
    expect(answersMatch('wrong', 'B', options)).toBe(false);
  });
});
