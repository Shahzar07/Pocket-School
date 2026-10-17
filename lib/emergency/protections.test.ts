import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_REVIEW_MS,
  anonymousReportAllowed,
  clampReviewEvery,
  consentProblems,
  losesReportingRights,
  reportAllowed,
  reviewExpired,
} from './protections';

test('a review window defaults to 24 hours and cannot pass 48', () => {
  assert.equal(clampReviewEvery(undefined), 24 * 60 * 60 * 1000);
  assert.equal(clampReviewEvery(72 * 60 * 60 * 1000), MAX_REVIEW_MS);
  assert.equal(reviewExpired(100, 100, 'active'), true);
  assert.equal(reviewExpired(100, 99, 'active'), false);
  assert.equal(reviewExpired(100, 200, 'resolved'), false);
});

test('missing child consent needs the guardian, the disclaimer, and a signature', () => {
  const ready = {
    details: 'Name, school shirt, and the north gate.',
    photo: false,
    regions: ['Kuala Lumpur'],
    channels: ['public page', 'push'],
    disclaimer: 'This is not a replacement for emergency services.',
    guardianName: 'Amina Yusuf',
    relation: 'mother',
    signature: 'Amina Yusuf',
    signatureKind: 'typed' as const,
    at: 1,
    ip: '127.0.0.1',
    device: 'test',
  };
  assert.equal(consentProblems(ready), null);
  assert.equal(consentProblems({ ...ready, signatureKind: 'drawn', signature: 'Amina Yusuf' }), 'A drawn signature is an image.');
  assert.ok(consentProblems({ ...ready, guardianName: '' }));
});

test('three reports a day, and a second false report removes the right to report', () => {
  assert.equal(reportAllowed({ countToday: 2, banned: false }), null);
  assert.match(reportAllowed({ countToday: 3, banned: false }) ?? '', /Three reports/);
  assert.match(reportAllowed({ countToday: 0, banned: true }) ?? '', /closed/);
  assert.match(anonymousReportAllowed({ countToday: 0, captchaRequired: true, captchaOk: false }) ?? '', /person/);
  assert.equal(anonymousReportAllowed({ countToday: 1, captchaRequired: false, captchaOk: false }), null);
  assert.equal(losesReportingRights(0), false);
  assert.equal(losesReportingRights(1), true);
});
