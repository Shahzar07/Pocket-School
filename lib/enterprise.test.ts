import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsToCsv,
  blankProfile,
  canHidePoweredBy,
  complianceState,
  filterDirectory,
  identityMode,
  institutionsToCsv,
  leadDraftError,
  parseMemberCsv,
  platformRoleForAcademy,
  renewalState,
  rollupAnalytics,
  seatUtilisation,
  tenantVisible,
  type DirectoryRow,
} from './enterprise';

const row = (id: string, name: string, status: DirectoryRow['status'], plan: DirectoryRow['profile']['plan']): DirectoryRow => ({
  id,
  name,
  status,
  domain: `${id}.edu`,
  subdomain: id,
  customDomain: '',
  profile: blankProfile({ plan, country: 'MY', type: 'school', seatCount: 40, seatsUsed: 10, renewalOn: '2026-12-01' }),
});

test('a super admin sees every tenant and an institution admin sees only theirs', () => {
  assert.equal(tenantVisible({ superAdmin: true }, 'school-b'), true);
  assert.equal(tenantVisible({ superAdmin: false, institutionId: 'school-a' }, 'school-a'), true);
  assert.equal(tenantVisible({ superAdmin: false, institutionId: 'school-a' }, 'school-b'), false);
  assert.equal(tenantVisible({ superAdmin: false, institutionId: null }, 'school-a'), false);
});

test('starter academies keep the Poket School mark', () => {
  assert.equal(canHidePoweredBy('starter'), false);
  assert.equal(canHidePoweredBy('team'), false);
  assert.equal(canHidePoweredBy('enterprise'), true);
  assert.equal(canHidePoweredBy('oem'), true);
});

test('directory search, filters, and CSV export', () => {
  const rows = [row('north', 'North Academy', 'active', 'enterprise'), row('south', 'South Campus', 'suspended', 'starter')];
  assert.equal(filterDirectory(rows, { query: 'north', status: 'active' }).length, 1);
  assert.equal(filterDirectory(rows, { plan: 'starter' })[0]?.id, 'south');
  const csv = institutionsToCsv(rows);
  assert.match(csv, /^name,type,country/);
  assert.match(csv, /North Academy,school,MY,enterprise,active,40,10/);
});

test('seats, renewals, compliance reminders, and analytics', () => {
  assert.equal(seatUtilisation(10, 40), 0.25);
  assert.equal(seatUtilisation(3, 0), 0);
  assert.equal(renewalState('2026-11-01', '2026-10-16'), 'soon');
  assert.equal(renewalState('2026-10-01', '2026-10-16'), 'lapsed');
  assert.equal(complianceState('2026-10-20', 7, '2026-10-16'), 'remind');
  assert.equal(complianceState('2026-10-15', 7, '2026-10-16'), 'overdue');
  const rollup = rollupAnalytics({
    seats: 40,
    seatsUsed: 10,
    members: 8,
    activeMembers: 4,
    completions: 1,
    assigned: 4,
    skills: { Numeracy: 2, Compliance: 3 },
  });
  assert.equal(rollup.engagement, 0.5);
  assert.equal(rollup.completionRate, 0.25);
  assert.equal(rollup.skills[0]?.name, 'Compliance');
  assert.match(analyticsToCsv(rollup), /completionRate,0.2500/);
});

test('member CSV accepts academy roles and SSO degrades without keys', () => {
  const parsed = parseMemberCsv('email,name,role\nAda@School.edu,Ada,institution admin\nbea@school.edu,Bea,learner\nnope,No,manager\n');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]?.academyRole, 'institution_admin');
  assert.equal(platformRoleForAcademy('manager'), 'teacher');
  assert.equal(platformRoleForAcademy('learner'), 'student');
  assert.equal(parsed.errors.length, 1);
  const dark = identityMode({});
  assert.equal(dark.mode, 'invite-only');
  assert.equal(dark.saml, false);
  assert.equal(dark.zoom, false);
  const ready = identityMode({
    SAML_ENTRY_POINT: 'https://idp.example/sso',
    SAML_ISSUER: 'poket',
    SAML_CERT: 'cert',
    OIDC_ISSUER: 'https://idp.example',
    OIDC_CLIENT_ID: 'id',
    OIDC_CLIENT_SECRET: 'secret',
    SCIM_BEARER_TOKEN: 'token',
  }, 'integrations.saml');
  assert.equal(ready.mode, 'sso');
  assert.equal(ready.scim, true);
  assert.equal(ready.lti, false);
});

test('a demo request needs a name, email, organisation, and country', () => {
  assert.equal(leadDraftError({
    name: 'A',
    email: 'a@school.edu',
    organisation: 'North',
    country: 'MY',
    type: 'school',
    seats: 20,
    message: '',
  }), 'Add your name.');
  assert.equal(leadDraftError({
    name: 'Ada Lovelace',
    email: 'ada@school.edu',
    organisation: 'North Academy',
    country: 'MY',
    type: 'school',
    seats: 20,
    message: 'We need a branded academy.',
  }), null);
});
