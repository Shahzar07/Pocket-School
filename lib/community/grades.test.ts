import { describe, it } from 'node:test';
import { expect } from '../test-expect';
import { mockStillOpen, predictedGrade, scoreAttempt } from './grades';

describe('predicted grades', () => {
  it('maps a percentage onto a grade', () => {
    expect(predictedGrade(91, 100)).toBe('A*');
    expect(predictedGrade(80, 100)).toBe('A');
    expect(predictedGrade(39, 100)).toBe('U');
    expect(predictedGrade(8, 10)).toBe('A');
  });

  it('marks exact answers and ignores late papers', () => {
    const result = scoreAttempt(
      [{ id: 'q1', prompt: '2+2', marks: 2, answer: '4' }, { id: 'q2', prompt: 'capital', marks: 1, answer: 'Paris' }],
      { q1: '4', q2: 'paris' },
    );
    expect(result).toEqual({ score: 3, maxScore: 3 });
    expect(mockStillOpen(1_000, 1_000)).toBe(true);
    expect(mockStillOpen(1_001, 1_000)).toBe(false);
  });
});
