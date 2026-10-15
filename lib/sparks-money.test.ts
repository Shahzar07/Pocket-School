import { describe, expect, it } from 'vitest';
import { monthlySparksForProfile, sparksRolloverForProfile } from './sparks';
import { annualAmount, annualSavingsLabel, formatCoursePrice } from './money';
import { publicDisplayName } from './display-name';
import { tierCovers, tierDefinition } from './entitlements';
import { tierForProgramme, yearsForProgramme } from './programmes';
import { PLATFORM_CURRENCY } from './money';

describe('Sparks follow the plan table', () => {
  it('gives the IGCSE plan 800 Sparks and 300 rollover', () => {
    const profile = { accessTier: 2, role: 'student' };
    expect(monthlySparksForProfile(profile)).toBe(tierDefinition(2).sparks);
    expect(monthlySparksForProfile(profile)).toBe(800);
    expect(sparksRolloverForProfile(profile)).toBe(300);
  });

  it('does not let a smaller custom allowance undercut the plan', () => {
    expect(monthlySparksForProfile({ accessTier: 2, sparksMonthlyAllowance: 100 })).toBe(800);
    expect(monthlySparksForProfile({ accessTier: 2, sparksMonthlyAllowance: 1500 })).toBe(1500);
  });

  it('gives a free account nothing monthly', () => {
    expect(monthlySparksForProfile({ role: 'student' })).toBe(0);
  });
});

describe('money copy', () => {
  it('says three months free because the discount is 25%', () => {
    expect(annualSavingsLabel()).toBe('3 months free');
    expect(annualAmount(49)).toBe(Math.round(49 * 12 * 0.75));
  });

  it('calls a zero price Free and formats US dollars', () => {
    expect(PLATFORM_CURRENCY).toBe('USD');
    expect(formatCoursePrice(0)).toBe('Free');
    expect(formatCoursePrice(49)).toBe('$49');
    expect(formatCoursePrice(49, 'MYR')).toContain('49');
  });
});

describe('programme access', () => {
  it('uses the master year bands', () => {
    expect(yearsForProgramme('Primary')).toEqual(['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']);
    expect(yearsForProgramme('Lower Secondary')).toEqual(['Year 6', 'Year 7', 'Year 8']);
    expect(tierForProgramme('Year 9')).toBe(2);
    expect(tierForProgramme('Year 1 (LLB)')).toBe(4);
    expect(yearsForProgramme('Micro Degree')).toEqual([]);
  });

  it('does not let the $19 plan open IGCSE, and does let the $99 plan', () => {
    expect(tierDefinition(1).usd).toBe(49);
    expect(tierDefinition(2).usd).toBe(79);
    expect(tierDefinition(3).usd).toBe(19);
    expect(tierDefinition(3).sparks).toBe(2000);
    expect(tierDefinition(4).usd).toBe(99);
    expect(tierCovers(3, 2)).toBe(false);
    expect(tierCovers(3, 3)).toBe(true);
    expect(tierCovers(4, 2)).toBe(true);
    expect(tierCovers(2, 1)).toBe(true);
    expect(tierCovers(1, 2)).toBe(false);
  });
});

describe('public names', () => {
  it('keeps a first name and a last initial', () => {
    expect(publicDisplayName('Harry Seggu')).toBe('Harry S.');
    expect(publicDisplayName('QA')).toBe('QA');
    expect(publicDisplayName('')).toBe('Student');
  });
});
