import { describe, it } from 'node:test';
import { expect } from '../test-expect';
import { allocResource } from '../entitlements';
import { canSeeResource, normaliseAudiences } from './store-access';

describe('creator store access', () => {
  const base = {
    status: 'approved',
    authorId: 'teacher',
    viewerId: 'student',
    viewerRole: 'student',
    audiences: [] as string[],
    permissions: [] as string[],
    resourceId: 'note1',
  };

  it('keeps an approved resource open until an audience is chosen', () => {
    expect(canSeeResource(base)).toBe(true);
    expect(canSeeResource({ ...base, status: 'draft' })).toBe(false);
    expect(canSeeResource({ ...base, status: 'draft', viewerId: 'teacher' })).toBe(true);
  });

  it('follows the allocation picker and a direct student grant', () => {
    expect(canSeeResource({ ...base, audiences: ['teachers'] })).toBe(false);
    expect(canSeeResource({ ...base, audiences: ['students'] })).toBe(true);
    expect(canSeeResource({ ...base, audiences: ['teachers'], permissions: [allocResource('note1')] })).toBe(true);
    expect(canSeeResource({ ...base, audiences: ['teachers', 'user:student'] })).toBe(true);
    expect(canSeeResource({ ...base, audiences: ['class:year10'], cohortIds: ['year10'] })).toBe(true);
    expect(normaliseAudiences(['marketplace', 'nope', 'students', 'user:ada'])).toEqual(['students', 'marketplace', 'user:ada']);
  });
});
