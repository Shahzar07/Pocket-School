import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS, isFeatureEnabled, resolveFlags } from './feature-flags';

describe('feature flags', () => {
  it('defaults every surface on when nothing is stored', () => {
    const flags = resolveFlags(undefined);
    expect(flags).toEqual(DEFAULT_FLAGS);
    expect(isFeatureEnabled(flags, 'snapAndSolve')).toBe(true);
  });

  it('lets an admin turn one surface off without clearing the others', () => {
    const flags = resolveFlags({ community: false, ignored: true });
    expect(isFeatureEnabled(flags, 'community')).toBe(false);
    expect(isFeatureEnabled(flags, 'examCentre')).toBe(true);
  });
});
