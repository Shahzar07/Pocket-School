import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asAgeTier } from './age-tier';
import {
  canPublishPortfolio,
  cvLines,
  cvPdf,
  defaultConsent,
  etSummary,
  publicPortfolioView,
  selfItem,
  sourceLabel,
  verifiedItems,
} from './portfolio';

const education = [{
  institutionId: 'north',
  institutionName: 'North Academy',
  level: 'IGCSE',
  from: '2022-09-01',
  to: '2024-06-01',
  studentNumber: 'PS-ABCD-2345',
}];

test('verified lines and self-reported lines keep their labels', () => {
  const consent = defaultConsent();
  const verified = verifiedItems({
    education,
    courses: [{ title: 'IGCSE Mathematics', when: '2024-06-01' }],
    scores: [{ title: 'IGCSE Mathematics', score: '86/100' }],
    certificates: [{ id: 'cert-1', title: 'IGCSE Mathematics', when: '2024-06-01' }],
    badges: [{ title: 'Graduate' }],
    projects: [{ title: 'Bridge model', detail: 'Studio project' }],
    endorsements: [{ title: 'Lab report', detail: 'Teacher-endorsed' }],
    includeScores: false,
  });
  assert.equal(verified.some((item) => item.kind === 'score'), false);
  assert.equal(verified.find((item) => item.kind === 'institution')?.source, 'verified');
  assert.equal(sourceLabel('verified'), 'Verified by Poket School');
  const withScores = verifiedItems({
    education: [],
    courses: [],
    scores: [{ title: 'IGCSE Mathematics', score: '86/100' }],
    certificates: [],
    badges: [],
    projects: [],
    endorsements: [],
    includeScores: true,
  });
  assert.equal(withScores[0]?.detail, '86/100');
  const volunteering = selfItem({
    kind: 'volunteering',
    title: 'Library club',
    detail: 'Tuesday shelving',
    evidenceLink: 'https://example.com/note',
  });
  assert.ok(!('error' in volunteering));
  if (!('error' in volunteering)) {
    assert.equal(volunteering.source, 'self_reported');
    assert.equal(sourceLabel(volunteering.source), 'Self-reported');
  }
  assert.deepEqual(selfItem({ kind: 'volunteering', title: 'Library club', evidenceLink: 'http://example.com' }), {
    error: 'An evidence link starts with https://',
  });
  assert.equal(consent.publicPortfolio, false);
  assert.equal(consent.includeScores, false);
});

test('ET AI restates the record and does not invent an achievement', () => {
  const draft = etSummary({
    name: 'Ada Lovelace',
    items: [
      { title: 'North Academy', detail: 'IGCSE', source: 'verified' },
      { title: 'Library club', detail: 'Tuesday shelving', source: 'self_reported' },
    ],
  });
  assert.equal(draft.invented, false);
  assert.equal(draft.fromRecord, true);
  assert.equal(draft.bullets.length, 2);
  assert.equal(draft.bullets.some((line) => line.includes('Medicine')), false);
  assert.equal(draft.summary.includes('2 recorded achievements'), true);
  const empty = etSummary({ name: 'Ada', items: [] });
  assert.equal(empty.summary, '');
  assert.deepEqual(empty.bullets, []);
});

test('a public portfolio stays off for a learner under 18 until a parent approves', () => {
  const consent = { ...defaultConsent(), publicPortfolio: true, sections: { ...defaultConsent().sections, education: 'public' as const } };
  const minor = asAgeTier('teen');
  const blocked = canPublishPortfolio({ ageTier: minor, wantsPublic: true, parentApproved: false });
  assert.equal(blocked.public, false);
  assert.match(blocked.reason, /under 18/);
  const closed = asAgeTier(undefined);
  assert.equal(canPublishPortfolio({ ageTier: closed, wantsPublic: true, parentApproved: false }).public, false);
  const approved = canPublishPortfolio({ ageTier: minor, wantsPublic: true, parentApproved: true });
  assert.equal(approved.public, true);
  const hidden = publicPortfolioView({
    name: 'Ada Lovelace',
    studentNumber: 'PS-ABCD-2345',
    items: verifiedItems({
      education,
      courses: [],
      scores: [],
      certificates: [],
      badges: [],
      projects: [],
      endorsements: [],
      includeScores: false,
    }),
    consent: { ...consent, parentApproved: false },
    ageTier: minor,
    summary: '',
  });
  assert.equal(hidden, null);
  const adult = publicPortfolioView({
    name: 'Ada Lovelace',
    studentNumber: 'PS-ABCD-2345',
    items: [],
    consent: { ...defaultConsent(), publicPortfolio: true },
    ageTier: 'adult',
    summary: 'Ready',
  });
  assert.equal(adult?.name, 'Ada L.');
  assert.equal(adult?.qrUrl, 'https://poketschool.ai/portfolio/PS-ABCD-2345');
});

test('the CV download is a one-page PDF', () => {
  const lines = cvLines([{
    id: 'edu-north',
    source: 'verified',
    kind: 'institution',
    title: 'North Academy',
    detail: 'IGCSE',
    when: '2022-09-01 – 2024-06-01',
    verifyUrl: '',
    evidenceLink: '',
    section: 'education',
  }]);
  const bytes = cvPdf({ template: 'deep', name: 'Ada L.', lines });
  const header = new TextDecoder().decode(bytes.slice(0, 8));
  assert.equal(header, '%PDF-1.4');
  assert.equal(lines[0]?.includes('Verified by Poket School'), true);
});
