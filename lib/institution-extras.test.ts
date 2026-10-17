import assert from 'node:assert/strict';
import test from 'node:test';
import {
  achievementPdf,
  albumOpen,
  appendParentBridge,
  applyGift,
  campaignProgress,
  canSeeOpening,
  draftEndorsement,
  endorsementWasEdited,
  givingIsOn,
  moderateOpening,
  parentBridgePlan,
  portfolioOnCertificate,
  proveSkills,
  readCampaign,
  readOpening,
  readOpportunity,
  readReunion,
  readSkillMap,
  readTalk,
  revokeEndorsement,
  sandboxGift,
  setEndorsementVisibility,
  setSkillVisibility,
  shareableCount,
  skillWasEdited,
  suggestOpportunities,
  talkVisibleToStudents,
  type SkillEvidence,
  type SkillMap,
} from './institution-extras';

const map: SkillMap = {
  id: 'algebra',
  name: 'Algebraic reasoning',
  institutionId: 'north',
  lessonIds: ['lesson-1'],
  blooms: ['apply'],
  badgeIds: ['badge-1'],
};

const lesson: SkillEvidence = { kind: 'lesson', id: 'lesson-1', lessonId: 'lesson-1', bloom: '', label: 'Lesson', url: 'https://poketschool.ai/lesson' };
const testHit: SkillEvidence = { kind: 'unit_test', id: 'quiz-1', lessonId: 'lesson-1', bloom: 'apply', label: 'Unit test', url: 'https://poketschool.ai/lesson' };
const wrongBloom: SkillEvidence = { kind: 'unit_test', id: 'quiz-2', lessonId: 'lesson-1', bloom: 'remember', label: 'Unit test', url: '' };
const badge: SkillEvidence = { kind: 'badge', id: 'badge-1', lessonId: '', bloom: '', label: 'Badge', url: 'https://poketschool.ai/verify/badge/badge-1' };

test('a proven skill keeps its evidence and can only be shown or hidden', () => {
  const [skill] = proveSkills([map], [lesson, testHit, wrongBloom, badge]);
  assert.equal(skill.name, 'Algebraic reasoning');
  assert.equal(skill.locked, true);
  assert.deepEqual(skill.evidence.map((item) => item.id), ['lesson-1', 'quiz-1', 'badge-1']);
  const hidden = setSkillVisibility(skill, false);
  assert.equal(hidden.visible, false);
  assert.equal(skillWasEdited(skill, { name: 'Renamed', evidence: skill.evidence }), true);
  assert.equal(skillWasEdited(skill, hidden), false);
});

test('a skill map needs a lesson or a badge', () => {
  assert.equal('error' in readSkillMap({ name: 'Maps' }), true);
  const read = readSkillMap({ name: 'Maps', lessonIds: ['lesson-9'], blooms: ['Analyse'] });
  assert.equal('error' in read, false);
  if (!('error' in read)) assert.deepEqual(read.blooms, ['analyze']);
});

test('a teacher reference is locked, hideable, and revocable', () => {
  const note = draftEndorsement({
    institutionId: 'north',
    studentId: 'student',
    teacherId: 'teacher',
    teacherName: 'Ada',
    teacherAge: 'adult',
    body: 'Ada explains a method clearly and checks the working.',
  });
  assert.equal('error' in note, false);
  if ('error' in note) return;
  assert.equal(note.locked, true);
  assert.equal(setEndorsementVisibility(note, false).visible, false);
  assert.equal(endorsementWasEdited(note, 'A different sentence.'), true);
  assert.equal(revokeEndorsement(note).revoked, true);
  assert.equal('error' in draftEndorsement({ ...note, teacherAge: 'teen', body: note.body }), true);
});

test('ET AI only returns opportunities that were entered', () => {
  const rows = [
    readOpportunity({
      kind: 'internship', title: 'Lab intern', organisation: 'North Lab', deadline: '2026-11-01',
      interests: ['biology'], levels: ['Oak'], minScore: 70, url: 'https://example.com/lab',
    }, 'north'),
    readOpportunity({
      kind: 'scholarship', title: 'City award', organisation: 'City', deadline: '2026-10-01',
      interests: ['music'], levels: ['Oak'], url: 'https://example.com/award',
    }, ''),
  ];
  assert.equal(rows.some((row) => 'error' in row), false);
  const entered = rows.filter((row): row is Exclude<typeof row, { error: string }> => !('error' in row));
  const matches = suggestOpportunities({
    interests: ['marine biology'],
    level: 'Oak',
    scores: [{ title: 'Unit test', score: '80%' }],
    opportunities: entered,
  });
  assert.deepEqual(matches.map((row) => row.title), ['Lab intern']);
  assert.equal(suggestOpportunities({ interests: [], level: 'Oak', scores: [], opportunities: entered }).length, 0);
  const low = suggestOpportunities({
    interests: ['biology'],
    level: 'Oak',
    scores: [{ title: 'Unit test', score: '20/40' }],
    opportunities: entered,
  });
  assert.equal(low.length, 0);
});

test('a school opening stays hidden until the academy publishes it', () => {
  const opening = readOpening({ kind: 'job', title: 'Desk assistant', employer: 'North Lab', deadline: '2026-12-01', posterRole: 'alumni' }, 'north');
  assert.equal('error' in opening, false);
  if ('error' in opening) return;
  assert.equal(canSeeOpening({ status: opening.status, sameSchool: true, staff: false }), false);
  const published = moderateOpening(opening, true);
  assert.equal(canSeeOpening({ status: published.status, sameSchool: true, staff: false }), true);
  assert.equal(canSeeOpening({ status: published.status, sameSchool: false, staff: false }), false);
});

test('alumni giving stays off until the academy turns it on, and gifts are sandbox receipts', () => {
  assert.equal(givingIsOn(undefined), false);
  assert.equal('error' in readCampaign({ title: 'Seat', kind: 'sponsor_seat', goal: 10 }, 'north', false), true);
  const campaign = readCampaign({ title: 'Seat fund', kind: 'sponsor_seat', goal: 100, currency: 'myr' }, 'north', true);
  assert.equal('error' in campaign, false);
  if ('error' in campaign) return;
  const gift = sandboxGift({ amount: 25, currency: campaign.currency, id: 'gift-1' });
  assert.equal('error' in gift, false);
  if ('error' in gift) return;
  assert.equal(gift.sandbox, true);
  assert.match(gift.receipt, /No card was charged/);
  assert.equal(campaignProgress(applyGift(campaign, 25)), 25);
});

test('a reunion can hide a small RSVP count and reopen the wall on its date', () => {
  const reunion = readReunion({ title: 'Oak reunion', when: '2026-12-12', place: 'Hall', ticketed: true, price: 0 }, 'north');
  assert.equal('error' in reunion, false);
  if ('error' in reunion) return;
  assert.equal(reunion.ticketed, false);
  assert.equal(reunion.wallOpenUntil, '2026-12-12');
  assert.equal(shareableCount(4), null);
  assert.equal(shareableCount(5), 5);
  assert.equal(albumOpen('2026-12-11', reunion.when), false);
  assert.equal(albumOpen('2026-12-12', reunion.when), true);
});

test('a career talk needs school approval and a Zoom, Meet, or Teams link when it is live', () => {
  const live = readTalk({ title: 'Lab paths', format: 'live', provider: 'meet', link: 'https://meet.google.com/abc-defg-hij', when: '2026-11-02', level: 'Oak' }, 'north');
  assert.equal('error' in live, false);
  if ('error' in live) return;
  assert.equal(talkVisibleToStudents(live), false);
  assert.equal(talkVisibleToStudents({ ...live, status: 'approved' }), true);
  assert.equal('error' in readTalk({ title: 'Lab paths', format: 'live', provider: 'meet', link: 'https://example.com/call' }, 'north'), true);
});

test('parents keep the achievement PDF, and an adult graduate agrees first', () => {
  const minor = parentBridgePlan({ ageTier: 'teen', consent: false, studentName: 'Sam' });
  assert.equal(minor.keepsPdf, true);
  const adult = parentBridgePlan({ ageTier: 'adult', consent: false, studentName: 'Sam' });
  assert.equal(adult.keepsPdf, false);
  assert.equal(adult.needsConsent, true);
  const agreed = parentBridgePlan({ ageTier: 'adult', consent: true, studentName: 'Sam' });
  assert.equal(agreed.keepsPdf, true);
  const letter = appendParentBridge({ subject: 'Graduated', text: 'Hello' }, adult);
  assert.match(letter.text, /18 or over/);
});

test('the certificate portfolio link follows the public switch', () => {
  assert.equal(portfolioOnCertificate({ publicPortfolio: false, ageTier: 'adult', parentApproved: false, studentNumber: 'PS1' }), '');
  assert.equal(portfolioOnCertificate({ publicPortfolio: true, ageTier: 'teen', parentApproved: false, studentNumber: 'PS1' }), '');
  assert.equal(
    portfolioOnCertificate({ publicPortfolio: true, ageTier: 'adult', parentApproved: false, studentNumber: 'ps1' }),
    'https://poketschool.ai/portfolio/PS1',
  );
  const pdf = new TextDecoder().decode(achievementPdf(['Poket School achievement summary']));
  assert.equal(pdf.startsWith('%PDF-1.4'), true);
});
