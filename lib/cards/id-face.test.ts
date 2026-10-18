import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POKET_SAMPLE_CARD,
  ROCHFORD_DEMO_CARD,
  academicYear,
  brandFromSchool,
  cardValidUntil,
  code39Runs,
  displayLevel,
  pdfAroundJpeg,
  viewFromPublic,
} from './id-face';

test('the Poket sample is Alex Student with a member number and a level name', () => {
  assert.equal(POKET_SAMPLE_CARD.fullName, 'Alex Student');
  assert.equal(POKET_SAMPLE_CARD.studentId, 'PSM-SAMPLE');
  assert.equal(POKET_SAMPLE_CARD.levelName, 'IGCSE');
  assert.equal(POKET_SAMPLE_CARD.sample, true);
  assert.equal(POKET_SAMPLE_CARD.brand.theme, 'poket');
  assert.equal(POKET_SAMPLE_CARD.brand.institutionName, 'Poket School');
  assert.equal(POKET_SAMPLE_CARD.brand.tagline, 'Free for every student');
  assert.equal(POKET_SAMPLE_CARD.brand.motto, 'Learn ● Grow ● Achieve');
  assert.equal(POKET_SAMPLE_CARD.brand.monogram, 'PS');
  assert.equal(POKET_SAMPLE_CARD.validUntil, 'While you learn');
  assert.equal(POKET_SAMPLE_CARD.academicYear, '2026/27');
  assert.equal(academicYear(new Date(2026, 9, 18)), '2026/27');
  assert.equal(cardValidUntil(new Date(2026, 9, 18)), 'July 2027');
});

test('the Rochford demo keeps school branding and a school number', () => {
  assert.equal(ROCHFORD_DEMO_CARD.brand.theme, 'rochford');
  assert.equal(ROCHFORD_DEMO_CARD.studentId, 'PS-1042');
  assert.equal(ROCHFORD_DEMO_CARD.sample, false);
  assert.equal(ROCHFORD_DEMO_CARD.brand.emergencyPhone, '03-0000 0199');
  const brand = brandFromSchool("Rochford's International School", { motto: 'Care.', logoUrl: 'https://example.com/logo.png', emergencyPhone: '03-1000 0000' });
  assert.equal(brand.theme, 'rochford');
  assert.equal(brand.motto, 'Care.');
  assert.equal(brand.logoUrl, 'https://example.com/logo.png');
  assert.equal(brandFromSchool('', null).theme, 'poket');
});

test('a public face does not print a student number', () => {
  const view = viewFromPublic({
    firstName: 'Amina',
    levelName: 'IGCSE',
    schoolName: 'Rochford',
    showPhoto: false,
    avatarUrl: '',
    badges: [],
  }, false);
  assert.equal(view.studentId, '');
  assert.equal(view.brand.institutionName, 'Poket School');
  assert.equal(view.validUntil, 'While you learn');
  assert.ok(code39Runs('PSM-SAMPLE').length > 10);
});

test('a Nigerian year code is shown as a level name', () => {
  assert.equal(displayLevel('300L'), 'Degree Year');
  assert.equal(displayLevel('IGCSE'), 'IGCSE');
  assert.equal(displayLevel('Primary 5'), 'Primary 5');
  assert.equal(displayLevel('A-Level'), 'A-Level');
  assert.equal(displayLevel('Year 5'), 'Learner');
  assert.equal(displayLevel('5'), 'Learner');
});

test('a card PDF wraps the jpeg on a credit-card page', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = pdfAroundJpeg(jpeg, { width: 820, height: 526 }, { width: 242.65, height: 155.65 });
  const text = new TextDecoder().decode(pdf);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Width 820/);
  assert.match(text, /242\.65 155\.65/);
  assert.ok(pdf.includes(0xff));
});
