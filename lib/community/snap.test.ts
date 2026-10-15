import { describe, expect, it } from 'vitest';
import { explainQuestion, snapGate } from './snap';

describe('snap gate', () => {
  const open = { flagOn: true, context: 'study' as const, openMock: false, parentAllows: true, hasInput: true };

  it('allows study use and blocks assessments, open mocks, and parent opt-out', () => {
    expect(snapGate(open).allowed).toBe(true);
    expect(snapGate({ ...open, context: 'assessment' }).reason).toBe('assessment');
    expect(snapGate({ ...open, openMock: true }).reason).toBe('open_mock');
    expect(snapGate({ ...open, parentAllows: false }).reason).toBe('parent');
    expect(snapGate({ ...open, flagOn: false }).reason).toBe('flag');
  });
});

describe('explainQuestion', () => {
  it('solves a linear equation and offers similar ones', () => {
    const solved = explainQuestion('2x + 4 = 10');
    expect(solved.answer).toBe('x = 3');
    expect(solved.steps.length).toBeGreaterThan(2);
    expect(solved.similar).toHaveLength(2);
  });
});
