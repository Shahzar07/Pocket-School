import { describe, it } from 'node:test';
import { expect } from '../test-expect';
import { isWithinQuietHours, nextVisibleAt, parseClock } from './quiet-hours';

const overnight = { start: '21:00', end: '07:00', timeZone: 'Asia/Kuala_Lumpur' };

describe('quiet hours', () => {
  it('covers an overnight window in the parent timezone', () => {
    const late = new Date('2026-10-15T14:30:00.000Z');
    const morning = new Date('2026-10-14T22:30:00.000Z');
    const afternoon = new Date('2026-10-15T06:00:00.000Z');
    expect(isWithinQuietHours(late, overnight)).toBe(true);
    expect(isWithinQuietHours(morning, overnight)).toBe(true);
    expect(isWithinQuietHours(afternoon, overnight)).toBe(false);
  });

  it('rejects a broken clock', () => {
    expect(parseClock('25:00')).toBeNull();
    expect(isWithinQuietHours(new Date(), { start: 'nope', end: '07:00', timeZone: 'UTC' })).toBe(false);
  });

  it('names the next moment a held message can show', () => {
    const late = new Date('2026-10-15T14:30:00.000Z');
    const visible = nextVisibleAt(late, overnight);
    expect(visible).not.toBeNull();
    expect(isWithinQuietHours(visible as Date, overnight)).toBe(false);
  });
});
