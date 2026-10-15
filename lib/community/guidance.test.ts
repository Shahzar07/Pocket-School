import { describe, it } from 'node:test';
import { expect } from '../test-expect';
import { guidanceFor } from './guidance';

describe('guidanceFor', () => {
  it('suggests medicine when biology and chemistry are strong', () => {
    const cards = guidanceFor({
      interests: ['Medicine'],
      predictedGrades: { biology: 'A*', chemistry: 'A' },
    });
    expect(cards.some((c) => c.title === 'Medicine MBBS' && c.kind === 'university')).toBe(true);
    expect(cards.some((c) => c.kind === 'career' && c.title === 'Doctor')).toBe(true);
    expect(cards.some((c) => c.title === 'Law LLB')).toBe(false);
  });

  it('stays encouraging when grades are still short of the offer', () => {
    const cards = guidanceFor({
      interests: ['engineering'],
      predictedGrades: { maths: 'C', physics: 'D' },
    });
    expect(cards[0]?.detail).toContain('not a decision');
  });
});
