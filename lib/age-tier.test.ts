import { describe, expect, it } from 'vitest';
import { ageTierFromDob, asAgeTier } from './age-tier';

const NOW = new Date(Date.UTC(2026, 9, 15));

describe('ageTierFromDob', () => {
  it('splits under-13, 13 to 17, and adults', () => {
    expect(ageTierFromDob('2013-10-16', NOW)).toBe('under13');
    expect(ageTierFromDob('2013-10-15', NOW)).toBe('teen');
    expect(ageTierFromDob('2009-10-16', NOW)).toBe('teen');
    expect(ageTierFromDob('2008-10-15', NOW)).toBe('adult');
    expect(ageTierFromDob('2008-10-16', NOW)).toBe('teen');
  });

  it('rejects future dates, impossible dates, and junk', () => {
    expect(ageTierFromDob('2030-01-01', NOW)).toBeNull();
    expect(ageTierFromDob('2010-02-31', NOW)).toBeNull();
    expect(ageTierFromDob('15/10/2010', NOW)).toBeNull();
    expect(ageTierFromDob('', NOW)).toBeNull();
  });

  it('fails closed when the stored tier is missing', () => {
    expect(asAgeTier(undefined)).toBe('under13');
    expect(asAgeTier('minor')).toBe('under13');
    expect(asAgeTier('teen')).toBe('teen');
    expect(asAgeTier('adult')).toBe('adult');
  });
});
