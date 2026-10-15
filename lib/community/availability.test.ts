import { describe, it } from 'node:test';
import { expect } from '../test-expect';
import { bookingFitsSlot, normaliseSlots } from './availability';

const NOW = Date.UTC(2026, 9, 15, 8, 0, 0);

describe('tutor slots', () => {
  it('keeps future slots and drops duplicates and the past', () => {
    const slots = normaliseSlots([
      { startAtMs: NOW + 3_600_000, minutes: 45 },
      { startAtMs: NOW + 3_600_000, minutes: 90 },
      { startAtMs: NOW - 3_600_000, minutes: 60 },
      { startAtMs: 'nope', minutes: 60 },
    ], NOW);
    expect(slots).toEqual([{ startAtMs: NOW + 3_600_000, minutes: 45 }]);
  });

  it('requires a published slot once the tutor has any', () => {
    const slots = [{ startAtMs: NOW + 3_600_000, minutes: 60 }];
    expect(bookingFitsSlot(slots, NOW + 3_600_000, NOW)).toBe(true);
    expect(bookingFitsSlot(slots, NOW + 7_200_000, NOW)).toBe(false);
    expect(bookingFitsSlot([], NOW + 7_200_000, NOW)).toBe(true);
    expect(bookingFitsSlot([], NOW - 3_600_000, NOW)).toBe(false);
  });
});
