import assert from 'node:assert/strict';
import test from 'node:test';
import { idCheckReady } from './id-check';
import {
  emailDomainMatches,
  emptyVerification,
  networkAllowed,
  parentAlertAllowed,
  publishBlock,
  raiseVerification,
  readVerification,
  requireTier,
  staffCaseAllowed,
  tierLabel,
} from './policy';

test('a missing verification record is basic, and tiers do not drop', () => {
  assert.equal(readVerification(undefined).tier, 0);
  assert.equal(tierLabel(0), 'Basic');
  assert.equal(tierLabel(4), 'Verified partner');
  const raised = raiseVerification(emptyVerification(), {
    tier: 2,
    method: 'guardian_link',
    verifiedAt: 10,
    verifiedBy: 'child-1',
  });
  assert.equal(raised.tier, 2);
  assert.equal(raiseVerification(raised, { tier: 1, method: 'otp', verifiedAt: 11, verifiedBy: 'self' }).tier, 2);
  assert.equal(requireTier(1, 1), true);
  assert.equal(requireTier(0, 1), false);
});

test('feature gates follow the tier, with Amber limited to a principal or a partner', () => {
  assert.equal(networkAllowed(0), false);
  assert.equal(networkAllowed(1), true);
  assert.equal(parentAlertAllowed(1), false);
  assert.equal(parentAlertAllowed(2), true);
  assert.equal(staffCaseAllowed('teacher', 2), false);
  assert.equal(staffCaseAllowed('teacher', 3), true);
  assert.equal(staffCaseAllowed('admin', 0), true);
  assert.match(publishBlock({ tier: 0, role: 'student', staffPost: '', institutionId: '', type: 'lockdown' }) ?? '', /Safety Desk/);
  assert.equal(publishBlock({ tier: 4, role: 'teacher', staffPost: '', institutionId: '', type: 'missing_child' }), null);
  assert.match(publishBlock({ tier: 3, role: 'teacher', staffPost: 'teacher', institutionId: 'school-1', type: 'missing_child' }) ?? '', /tier 3 principal/);
  assert.equal(publishBlock({ tier: 3, role: 'teacher', staffPost: 'principal', institutionId: 'school-1', type: 'missing_child' }), null);
  assert.equal(publishBlock({ tier: 0, role: 'admin', staffPost: '', institutionId: '', type: 'lockdown' }), null);
  assert.equal(emailDomainMatches('ada@poketschool.ai', 'poketschool.ai'), true);
  assert.equal(emailDomainMatches('ada@other.ai', 'poketschool.ai'), false);
  assert.equal(idCheckReady({}), false);
  assert.equal(idCheckReady({ ID_CHECK_API_KEY: 'set' }), true);
});
