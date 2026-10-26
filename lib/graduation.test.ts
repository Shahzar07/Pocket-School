import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alumniStats } from './alumni';
import {
  achievementLines,
  alumniCheckoutCoupon,
  alumniUpgradeUrl,
  canUndoGraduation,
  graduationCard,
  graduationLetter,
  graduationSuggestions,
  individualOffer,
  individualPlanSku,
  previewGraduationBill,
  undoUntil,
} from './graduation';

const roster = [
  { role: 'student', status: 'joined', level: 'Professional', studentId: 'ada', schoolStudentId: 'S-1', name: 'Ada Lovelace', email: 'ada@school.edu.my', studentNumber: 'PS-ABCD-2345' },
  { role: 'student', status: 'joined', level: 'Law', studentId: 'grace', schoolStudentId: 'S-2', name: 'Grace Hopper', email: 'grace@school.edu.my', studentNumber: 'PS-EFGH-6789' },
  { role: 'student', status: 'joined', level: 'IGCSE', studentId: 'alan', schoolStudentId: 'S-3', name: 'Alan Turing', email: 'alan@school.edu.my', studentNumber: 'PS-IJKL-1111' },
  { role: 'student', status: 'leaver', level: 'Professional', studentId: 'left', schoolStudentId: 'S-4', name: 'Left Already', email: 'left@school.edu.my', studentNumber: '' },
  { role: 'parent', status: 'joined', level: 'Professional', studentId: 'parent', schoolStudentId: '', name: 'Parent', email: 'parent@school.edu.my', studentNumber: '' },
];

test('final-level students are suggested and the bill is shown before confirm', () => {
  const ready = graduationSuggestions(roster);
  assert.deepEqual(ready.map((row) => row.studentId), ['ada', 'grace']);
  const preview = previewGraduationBill({
    graduating: ready.length,
    currentStudents: 60,
    currentSeats: 60,
    currentTotal: 600,
    currentTierId: 'growth',
    itemIds: ['igcse'],
    interval: 'monthly',
    country: 'US',
    periodStart: '2026-10-01',
    periodEnd: '2026-11-01',
    today: '2026-10-17',
    billingActive: true,
  });
  assert.equal(preview.seatsFreed, 2);
  assert.equal(preview.studentsAfter, 58);
  assert.equal(preview.action, 'stay');
  assert.match(preview.message, /2 seats are free today/);
  const cheaper = previewGraduationBill({
    graduating: 12,
    currentStudents: 60,
    currentSeats: 60,
    currentTotal: 600,
    currentTierId: 'growth',
    itemIds: ['igcse'],
    interval: 'monthly',
    country: 'US',
    periodStart: '2026-10-01',
    periodEnd: '2026-11-01',
    today: '2026-10-17',
    billingActive: true,
  });
  assert.equal(cheaper.seatsFreed, 12);
  assert.equal(cheaper.studentsAfter, 48);
  assert.equal(cheaper.action, 'suggest_downgrade');
  assert.match(cheaper.message, /Starter/);
  assert.equal(cheaper.charge, 0);
  const quiet = previewGraduationBill({
    graduating: 4,
    currentStudents: 4,
    currentSeats: 4,
    currentTotal: 40,
    itemIds: [],
    interval: 'monthly',
    country: 'US',
    periodStart: '',
    periodEnd: '',
    today: '2026-10-17',
    billingActive: false,
  });
  assert.equal(quiet.action, 'no_bill');
  assert.equal(quiet.seatsFreed, 4);
  assert.match(quiet.message, /bill is active/);
});

test('undo stays open for 7 days and restores nothing after that', () => {
  assert.equal(undoUntil('2026-10-17'), '2026-10-24');
  assert.equal(canUndoGraduation({ leftOn: '2026-10-17', today: '2026-10-24', seatFreed: true }), true);
  assert.equal(canUndoGraduation({ leftOn: '2026-10-17', today: '2026-10-25', seatFreed: true }), false);
  assert.equal(canUndoGraduation({ leftOn: '2026-10-17', today: '2026-10-18', undoneOn: '2026-10-18', seatFreed: false }), false);
});

test('the letter, the card, and the one-page summary stay inside one page', () => {
  const letter = graduationLetter({
    audience: 'student',
    institutionName: 'North Academy',
    studentName: 'Ada Lovelace',
    discount: 0.15,
    reviewOpen: false,
    graceEndsOn: '2026-10-17',
    upgradeUrl: alumniUpgradeUrl('Professional'),
  });
  assert.match(letter.text, /individual account/);
  assert.match(letter.text, /Still free/);
  assert.match(letter.text, /Paid from here/);
  assert.match(letter.text, /15%/);
  assert.match(letter.text, /sku=professional/);
  const parent = graduationLetter({
    audience: 'parent',
    institutionName: 'North Academy',
    studentName: 'Ada Lovelace',
    discount: 0.15,
    reviewOpen: true,
    graceEndsOn: '2026-10-27',
    upgradeUrl: alumniUpgradeUrl('Professional'),
  });
  assert.match(parent.subject, /Ada Lovelace graduated/);
  assert.match(parent.text, /review until 2026-10-27/);
  const lines = achievementLines({
    name: 'Ada Lovelace',
    studentNumber: 'PS-ABCD-2345',
    institutionName: 'North Academy',
    level: 'Professional',
    graduatedOn: '2026-10-17',
    badge: 'Graduate',
    courses: ['Professional practice'],
    certificates: ['IGCSE Mathematics'],
    discount: 0.15,
    verifyUrl: 'https://poketschool.ai/p/PS-ABCD-2345',
  });
  assert.ok(lines.length <= 42);
  assert.ok(lines.every((line) => line.length <= 100));
  assert.equal(lines[0], 'Poket School achievement summary');
  assert.ok(lines.some((line) => line.includes('Graduate')));
  assert.ok(lines.some((line) => line.includes('Still free')));
  const card = graduationCard({
    name: 'Ada Lovelace',
    institutionName: 'North Academy',
    level: 'Professional',
    studentNumber: 'ps-abcd-2345',
    graduatedOn: '2026-10-17',
  });
  assert.equal(card.badge, 'Graduate');
  assert.equal(card.publicName, 'Ada L.');
  assert.equal(card.qrUrl, 'https://poketschool.ai/p/PS-ABCD-2345');
});

test('the alumni percent is a checkout coupon and seats freed are counted by year', () => {
  assert.equal(individualPlanSku('Law'), 'professional');
  assert.equal(individualPlanSku('Medicine'), 'professional');
  assert.equal(individualPlanSku('MBBS'), 'professional');
  assert.equal(individualPlanSku('Primary'), 'primary_secondary');
  assert.equal(individualPlanSku('IGCSE'), 'igcse_alevel');
  const offer = individualOffer('Professional', 0.15);
  assert.equal(offer.sku, 'professional');
  assert.equal(offer.listMonthly, 99);
  assert.equal(offer.monthly, 84.15);
  assert.equal(alumniCheckoutCoupon(0.15)?.percentOff, 15);
  assert.equal(alumniCheckoutCoupon(0.15)?.code, 'ALUMNI');
  assert.equal(alumniCheckoutCoupon(0), null);
  const stats = alumniStats([
    { leftOn: '2026-10-17', certificates: 2, seatFreed: true },
    { leftOn: '2026-03-01', certificates: 1, seatFreed: true, undoneOn: '2026-03-02' },
    { leftOn: '2025-06-01', certificates: 1 },
  ]);
  assert.equal(stats.seatsFreed, 1);
  assert.equal(stats.byYear.find((row) => row.year === '2026')?.graduates, 2);
  assert.equal(stats.byYear.find((row) => row.year === '2026')?.seatsFreed, 1);
  assert.equal(stats.byYear.find((row) => row.year === '2025')?.seatsFreed, 0);
});
