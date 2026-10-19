import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterPublicDirectory,
  isPublicDirectorySchool,
  membershipOutcome,
  type DirectorySource,
} from './public-directory';

const north: DirectorySource = {
  id: 'north',
  name: 'North Academy',
  status: 'active',
  country: 'MY',
  state: 'Perak',
  city: 'Ipoh',
  plan: 'enterprise',
  listedForSelfJoin: true,
  branding: { displayName: 'North Academy', logoUrl: 'https://cdn.example/north.png' },
  inviteAutoApprove: true,
};

test('only active Institute or Enterprise schools with public listing are shown', () => {
  const rows: DirectorySource[] = [
    north,
    { id: 'inst', name: 'Institute School', status: 'active', country: 'MY', state: 'Perak', package: 'institute', publicListing: true },
    { id: 'team', name: 'Team School', status: 'active', country: 'MY', state: 'Perak', plan: 'team', listedForSelfJoin: true },
    { id: 'hidden', name: 'Hidden Enterprise', status: 'active', country: 'MY', state: 'Perak', plan: 'enterprise', listedForSelfJoin: false },
    { id: 'paused', name: 'Paused', status: 'suspended', country: 'MY', state: 'Perak', plan: 'enterprise', listedForSelfJoin: true },
    { id: 'unpaid', name: 'Unpaid', status: 'active', country: 'MY', state: 'Perak', plan: 'enterprise', listedForSelfJoin: true, billingPhase: 'pending_payment' },
  ];
  const listed = filterPublicDirectory(rows, { country: 'MY', state: 'Perak' });
  assert.deepEqual(listed.map((row) => row.id), ['inst', 'north']);
  assert.equal(listed[1]?.logo, 'https://cdn.example/north.png');
  assert.equal(listed[1]?.city, 'Ipoh');
  assert.equal(isPublicDirectorySchool(rows[2]!), false);
});

test('type-ahead and country filter drop schools that do not match', () => {
  const rows: DirectorySource[] = [
    north,
    { id: 'harbour', name: 'Harbour College', status: 'active', country: 'MY', state: 'Penang', plan: 'institute', publicListing: true },
    { id: 'lakes', name: 'Lakeside', status: 'active', country: 'GB', state: 'England', plan: 'enterprise', listedForSelfJoin: true },
  ];
  assert.deepEqual(filterPublicDirectory(rows, { country: 'MY', state: 'Perak', q: 'north' }).map((row) => row.id), ['north']);
  assert.deepEqual(filterPublicDirectory(rows, { country: 'MY', q: 'har' }).map((row) => row.id), ['harbour']);
  assert.equal(filterPublicDirectory(rows, { country: 'MY', state: 'Perak', q: 'zzz' }).length, 0);
});

test('a valid invite code auto-approves only when the school allows it', () => {
  assert.equal(membershipOutcome({ eligible: true, codeValid: true, autoApprove: true }), 'approved');
  assert.equal(membershipOutcome({ eligible: true, codeValid: true, autoApprove: false }), 'pending');
  assert.equal(membershipOutcome({ eligible: true, codeValid: false, autoApprove: true }), 'pending');
  assert.equal(membershipOutcome({ eligible: false, codeValid: true, autoApprove: true }), 'independent');
});
