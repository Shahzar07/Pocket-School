import assert from 'node:assert/strict';
import { test } from 'node:test';
import { institutionEmail } from './institution-membership';
import { decideInstitutionLogin } from './institution-login';
import {
  institutionAdminDestination,
  journeyDone,
  loginPageIsLive,
  slugAvailabilityLabel,
  validateInstitutionApplication,
} from './institution-journey';

const application = {
  organisation: 'Rochfords',
  type: 'school',
  country: 'gb',
  state: 'England',
  name: 'Ada Lovelace',
  email: 'Ada@Rochfords.Example',
  phone: '+44 20 7946 0991',
  title: 'Principal',
  gender: 'female',
  password: 'correct-horse',
};

test('a complete application is accepted and a partial one is named', () => {
  const ok = validateInstitutionApplication(application);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.email, 'ada@rochfords.example');
    assert.equal(ok.value.country, 'GB');
    assert.equal(ok.value.type, 'school');
  }
  assert.equal(validateInstitutionApplication({ ...application, organisation: ' ' }).ok, false);
  assert.equal(validateInstitutionApplication({ ...application, type: 'club' }).ok, false);
  assert.equal(validateInstitutionApplication({ ...application, state: 'Mars' }).ok, false);
  assert.equal(validateInstitutionApplication({ ...application, gender: 'other' }).ok, false);
  assert.equal(validateInstitutionApplication({ ...application, password: 'short' }).ok, false);
  const badEmail = validateInstitutionApplication({ ...application, email: 'not-an-email' });
  assert.equal(badEmail.ok, false);
  if (!badEmail.ok) assert.match(badEmail.error, /email/i);
});

test('sign-in lands on pending, the checklist, or the academy dashboard', () => {
  assert.equal(institutionAdminDestination({ status: 'pending' }), '/institutions/pending');
  assert.equal(
    institutionAdminDestination({ status: 'pending', billingPhase: 'pending_payment' }),
    '/institutions/checkout',
  );
  assert.equal(
    institutionAdminDestination({ status: 'pending', billingPhase: 'pending_payment', reviewHold: true }),
    '/institutions/pending',
  );
  assert.equal(institutionAdminDestination({ status: 'suspended' }), '/institutions/pending');
  assert.equal(institutionAdminDestination({ status: null }), '/institutions/pending');
  assert.equal(
    institutionAdminDestination({ status: 'active', setupComplete: false }),
    '/dashboard/institution/onboarding',
  );
  assert.equal(
    institutionAdminDestination({ status: 'active', setupComplete: true }),
    '/dashboard/institution',
  );
  assert.equal(institutionAdminDestination({ status: 'active' }), '/dashboard/institution');
});

test('branded login stays live for academies that already have a subdomain', () => {
  assert.equal(loginPageIsLive({ subdomain: 'north' }), true);
  assert.equal(loginPageIsLive({ subdomain: 'north', branding: { loginPublished: false } }), false);
  assert.equal(loginPageIsLive({ subdomain: 'north', branding: { loginPublished: true } }), true);
  assert.equal(loginPageIsLive({ branding: { loginPublished: true } }), true);
  assert.equal(loginPageIsLive({}), false);
  assert.match(slugAvailabilityLabel('rochfords', true), /poketschool\.ai\/i\/rochfords/);
  assert.match(slugAvailabilityLabel('ab', null), /rochfords/);
  assert.match(slugAvailabilityLabel('north', false), /already in use/);
});

test('the setup checklist follows the academy record', () => {
  const fresh = journeyDone({ name: 'Rochfords', country: 'GB', state: 'England' });
  assert.equal(fresh.profile, true);
  assert.equal(fresh.brand, false);
  assert.equal(fresh.students, false);
  const ready = journeyDone({
    name: 'Rochfords',
    country: 'GB',
    state: 'England',
    subdomain: 'rochfords',
    loginPublished: true,
    coAdminCount: 2,
    teacherCount: 3,
    inviteCount: 1,
    courseCount: 2,
    billingReady: true,
    sparksReady: true,
  });
  assert.equal(Object.values(ready).every(Boolean), true);
});

test('approval mail points the admin at sign-in', () => {
  const mail = institutionEmail('academy_approved', {
    institutionName: 'Rochfords',
    personName: 'Ada Lovelace',
    link: 'https://poketschool.ai/institutions/login',
  });
  assert.match(mail.subject, /Rochfords/);
  assert.match(mail.text, /Ada Lovelace/);
  assert.match(mail.text, /institutions\/login/);
});

test('branded sign-in follows the same destination as the main site', () => {
  const admin = { role: 'institution_admin', institutionId: 'north' };
  assert.equal(
    decideInstitutionLogin(admin, 'north', { institutionStatus: 'pending', tab: 'institution_admin' }).allowed
      && (decideInstitutionLogin(admin, 'north', { institutionStatus: 'pending' }) as { destination: string }).destination,
    '/institutions/pending',
  );
  const first = decideInstitutionLogin(admin, 'north', { institutionStatus: 'active', setupComplete: false });
  assert.equal(first.allowed && first.destination, '/dashboard/institution/onboarding');
  const later = decideInstitutionLogin(admin, 'north', { institutionStatus: 'active', setupComplete: true });
  assert.equal(later.allowed && later.destination, '/dashboard/institution');
  const legacy = decideInstitutionLogin(admin, 'north', { institutionStatus: 'active' });
  assert.equal(legacy.allowed && legacy.destination, '/dashboard/institution');
});
