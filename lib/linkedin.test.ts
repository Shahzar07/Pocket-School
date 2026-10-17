import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkedInCertificationUrl, shareLinks } from './credentials/badge-model';
import {
  canConfirmVerification,
  isShareToken,
  linkedInAuthorizeUrl,
  linkedInPack,
  linkedInSignInEnabled,
  memberShareDecision,
  readApplication,
  readShareLabel,
  readVisitorLabel,
  reminderDue,
  shareExpiresOn,
  shareIsOpen,
  shareTokenFrom,
  tailorBullets,
  viewTracker,
} from './linkedin';

test('Add to Profile uses an organization id when one is set, and the Poket School name otherwise', () => {
  const withId = new URL(linkedInCertificationUrl({
    name: 'IGCSE Mathematics',
    organizationId: '12345',
    issuedAt: '2026-06-01T00:00:00.000Z',
    certUrl: 'https://poketschool.ai/verify/cert-1',
    certId: 'cert-1',
  }));
  assert.equal(withId.origin + withId.pathname, 'https://www.linkedin.com/profile/add');
  assert.equal(withId.searchParams.get('startTask'), 'CERTIFICATION_NAME');
  assert.equal(withId.searchParams.get('organizationId'), '12345');
  assert.equal(withId.searchParams.get('organizationName'), null);
  assert.equal(withId.searchParams.get('issueYear'), '2026');
  assert.equal(withId.searchParams.get('issueMonth'), '6');
  assert.equal(withId.searchParams.get('certUrl'), 'https://poketschool.ai/verify/cert-1');
  assert.equal(withId.searchParams.get('certId'), 'cert-1');

  const fallback = new URL(linkedInCertificationUrl({
    name: 'Graduate',
    issuedAt: '2026-06-01T00:00:00.000Z',
    certUrl: 'https://poketschool.ai/verify/badge/grad',
    certId: 'grad',
  }));
  assert.equal(fallback.searchParams.get('organizationName'), 'Poket School');
  assert.equal(fallback.searchParams.get('organizationId'), null);
});

test('share-offsite is the public LinkedIn share URL and a member post stays off', () => {
  const share = shareLinks('https://poketschool.ai/verify/cert-1', 'IGCSE Mathematics');
  assert.equal(share.linkedin, 'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fpoketschool.ai%2Fverify%2Fcert-1');
  const off = memberShareDecision({ flag: '', hasMemberToken: false });
  assert.equal(off.allowed, false);
  const flagged = memberShareDecision({ flag: 'on', hasMemberToken: false });
  assert.equal(flagged.allowed, false);
  assert.match(flagged.reason, /w_member_social/);
});

test('Sign in with LinkedIn stays hidden without keys and requests OpenID only', () => {
  assert.equal(linkedInSignInEnabled({ clientId: '', clientSecret: 'secret' }), false);
  assert.equal(linkedInSignInEnabled({ clientId: 'abc', clientSecret: '' }), false);
  assert.equal(linkedInSignInEnabled({ clientId: 'abc', clientSecret: 'secret' }), true);
  const url = new URL(linkedInAuthorizeUrl({
    clientId: 'abc',
    redirectUri: 'https://poketschool.ai/api/auth/linkedin/callback',
    state: 'nonce',
  }));
  assert.equal(url.origin + url.pathname, 'https://www.linkedin.com/oauth/v2/authorization');
  assert.equal(url.searchParams.get('scope'), 'openid profile email');
  assert.equal(url.searchParams.get('scope')?.includes('w_member_social'), false);
});

test('portfolio text is ready for Featured, Contact info, About, Experience, and Education', () => {
  const pack = linkedInPack({
    name: 'Ada L.',
    studentNumber: 'ps-abcd-2345',
    items: [
      { source: 'verified', kind: 'institution', title: 'North Academy', detail: 'IGCSE', when: '2024-06-01' },
      { source: 'verified', kind: 'project', title: 'Bridge model', detail: 'Studio project', when: '' },
      { source: 'self_reported', kind: 'work', title: 'Library club', detail: 'Tuesday shelving', when: '' },
    ],
  });
  assert.equal(pack.featured, 'https://poketschool.ai/portfolio/PS-ABCD-2345');
  assert.equal(pack.website, pack.featured);
  assert.match(pack.about, /Verified by Poket School|verified by Poket School/);
  assert.match(pack.education, /North Academy/);
  assert.match(pack.experience, /Bridge model/);
  assert.match(pack.experience, /Self-reported/);
  assert.match(pack.text, /Featured/);
  assert.match(pack.text, /Contact info website/);
});

test('ET AI tailors bullets from verified achievements and does not invent a skill from the job', () => {
  const missed = tailorBullets({
    jobText: 'Python developer for a data team',
    items: [{ title: 'Library club', detail: 'Tuesday shelving', source: 'verified' }],
  });
  assert.deepEqual(missed.bullets, []);
  assert.equal(missed.invented, false);
  assert.equal(JSON.stringify(missed).includes('Python'), false);

  const matched = tailorBullets({
    jobText: 'Mathematics teacher who can explain algebra',
    items: [
      { title: 'IGCSE Mathematics', detail: 'Final assessment passed', source: 'verified' },
      { title: 'Python club', detail: 'After school', source: 'self_reported' },
    ],
  });
  assert.equal(matched.bullets.length, 1);
  assert.match(matched.bullets[0] ?? '', /IGCSE Mathematics — Final assessment passed/);
  assert.equal(/teacher/i.test(matched.bullets[0] ?? ''), false);
  assert.equal(JSON.stringify(matched).includes('Python'), false);
  assert.equal(matched.fromRecord, true);
});

test('a share link expires, a revoked link stays closed, and the tracker keeps only what a visitor types', () => {
  const label = readShareLabel('  Company X - Analyst  ');
  assert.equal('label' in label ? label.label : '', 'Company X - Analyst');
  assert.equal(shareExpiresOn('2026-10-01', 30), '2026-10-31');
  assert.equal(shareIsOpen({ expiresOn: '2026-10-31', revoked: false, today: '2026-10-17' }), true);
  assert.equal(shareIsOpen({ expiresOn: '2026-10-01', revoked: false, today: '2026-10-17' }), false);
  assert.equal(shareIsOpen({ expiresOn: '2026-12-01', revoked: true, today: '2026-10-17' }), false);
  const token = shareTokenFrom(new Uint8Array(24).fill(11));
  assert.equal(isShareToken(token), true);
  const tracker = viewTracker([
    { at: '2026-10-02T00:00:00.000Z', itemTitle: 'IGCSE Mathematics', visitorLabel: readVisitorLabel('  North HR  ') },
    { at: '2026-10-03T00:00:00.000Z', itemTitle: 'IGCSE Mathematics', visitorLabel: '' },
    { at: '2026-10-01T00:00:00.000Z', itemTitle: '', visitorLabel: '' },
  ]);
  assert.equal(tracker.total, 3);
  assert.equal(tracker.latest, '2026-10-03T00:00:00.000Z');
  assert.deepEqual(tracker.items[0], { title: 'IGCSE Mathematics', count: 2 });
  assert.equal(JSON.stringify(tracker).includes('ip'), false);
  assert.equal(canConfirmVerification('employer'), false);
  assert.equal(canConfirmVerification('learner'), true);
  assert.equal(canConfirmVerification('school'), true);
});

test('an application reminder is due only after the learner has applied or is interviewing', () => {
  const saved = readApplication({
    company: 'Company X',
    role: 'Analyst',
    link: 'https://example.com/jobs/analyst',
    status: 'applied',
    date: '2026-10-01',
    shareToken: shareTokenFrom(new Uint8Array(24).fill(2)),
    reminderOn: '2026-10-10',
  });
  assert.equal('error' in saved, false);
  if ('error' in saved) return;
  assert.equal(reminderDue({ status: saved.status, reminderOn: saved.reminderOn, today: '2026-10-17' }), true);
  assert.equal(reminderDue({ status: 'draft', reminderOn: '2026-10-10', today: '2026-10-17' }), false);
  assert.equal('error' in readApplication({
    company: 'Company X',
    role: 'Analyst',
    link: 'http://example.com/jobs',
    status: 'applied',
    date: '2026-10-01',
  }), true);
});
