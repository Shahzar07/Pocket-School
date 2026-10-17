import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalRoute, cleanPartnerApplication, partnerType } from './partners';
import { COMMUNITY_PARTNERS_LINE, safetyMessageFooter } from '../safety/disclaimer';

test('an application is checked and a honeypot is not stored as a real request', () => {
  const bad = cleanPartnerApplication({ orgName: 'A', type: 'school', country: 'Malaysia', contactName: 'Ada', email: 'ada@school.org' });
  assert.equal(bad.ok, false);
  const honeypot = cleanPartnerApplication({
    orgName: 'River School',
    type: 'school',
    country: 'Malaysia',
    contactName: 'Ada',
    email: 'ada@school.org',
    companyFax: 'bot',
  });
  assert.equal(honeypot.ok, true);
  if (honeypot.ok) assert.equal(honeypot.value.companyFax, 'bot');
  const good = cleanPartnerApplication({
    orgName: 'River School',
    type: 'business',
    country: 'Malaysia',
    contactName: 'Ada',
    email: 'ada@school.org',
    website: 'https://river.example',
  });
  assert.equal(good.ok, true);
});

test('approval names an onboarding path and does not verify the organisation', () => {
  assert.equal(approvalRoute('police')?.route, 'tier4');
  assert.equal(approvalRoute('child_protection')?.route, 'tier4');
  assert.equal(approvalRoute('school')?.route, 'institution');
  assert.equal(approvalRoute('business')?.route, 'partner_merchant');
  assert.equal(partnerType('school')?.label.includes('School'), true);
  assert.equal(approvalRoute('nope'), null);
});

test('safety messages invite community partners', () => {
  const footer = safetyMessageFooter('999');
  assert.match(footer, new RegExp(COMMUNITY_PARTNERS_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(footer, /https:\/\/poketschool\.ai\/community-partners/);
});
