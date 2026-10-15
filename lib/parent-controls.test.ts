import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIVILEGED_PROFILE_FIELDS, SELF_SERVICE_FIELDS } from './account-settings';
import {
  NEUTRAL_LINK,
  acceptInvite,
  childMayAddSelf,
  childPhotoPath,
  decideLink,
  defaultChildControls,
  inviteCodeFromBytes,
  inviteCodeValid,
  normaliseChildControls,
  normalisePaymentMethod,
  openInvite,
  parentMayEditChild,
  parentMayShrinkChildIds,
  pendingLink,
  purchaseNeedsParent,
  reportChannels,
  strictestControls,
  under13ProfilePatch,
  withinScreenTime,
  withinSparksLimit,
} from './parent-controls';

test('an email link request hides the child and stays pending', () => {
  const request = pendingLink({
    parentId: 'parent-1',
    parentName: ' Sara ',
    parentEmail: 'Parent@poketschool.ai',
    studentId: 'child-1',
    studentEmail: 'Student@poketschool.ai',
  });
  assert.equal(request.status, 'pending');
  assert.equal(request.parentEmail, 'parent@poketschool.ai');
  assert.equal(request.studentEmail, 'student@poketschool.ai');
  assert.equal('name' in request, false);
  assert.match(NEUTRAL_LINK, /name stays hidden/);
});

test('a child can approve only their own pending link, then add only their own id', () => {
  const approved = decideLink({ status: 'pending', studentId: 'child-1', parentId: 'parent-1' }, 'child-1', true);
  assert.equal(approved?.status, 'approved');
  assert.equal(decideLink({ status: 'pending', studentId: 'child-1', parentId: 'parent-1' }, 'other', true), null);
  assert.equal(decideLink({ status: 'approved', studentId: 'child-1', parentId: 'parent-1' }, 'child-1', true), null);
  assert.equal(childMayAddSelf(['older'], ['older', 'child-1'], 'child-1'), true);
  assert.equal(childMayAddSelf(['child-1'], ['child-1', 'friend'], 'child-1'), false);
  assert.equal(childMayAddSelf([], ['friend'], 'child-1'), false);
  assert.equal(parentMayShrinkChildIds(['child-1', 'child-2'], ['child-2']), true);
  assert.equal(parentMayShrinkChildIds(['child-1'], ['child-1', 'stranger']), false);
});

test('an invite code is eight characters and can be accepted once', () => {
  const code = inviteCodeFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(inviteCodeValid(code), true);
  assert.equal(code.length, 8);
  const opened = openInvite('parent-1', 'Sara', code);
  assert.equal(opened?.status, 'open');
  assert.equal(openInvite('parent-1', 'Sara', 'short'), null);
  assert.deepEqual(acceptInvite({ status: 'open', parentId: 'parent-1' }, 'child-1'), {
    status: 'accepted',
    childId: 'child-1',
    parentId: 'parent-1',
  });
  assert.equal(acceptInvite({ status: 'accepted', parentId: 'parent-1' }, 'child-1'), null);
});

test('a parent edits an under-13 profile and nobody else', () => {
  assert.equal(parentMayEditChild('under13'), true);
  assert.equal(parentMayEditChild('teen'), false);
  assert.equal(parentMayEditChild(undefined), false);
  const patch = under13ProfilePatch({
    name: ' Adam ',
    displayName: 'Adam',
    bio: 'Year 4',
    avatarUrl: 'https://example.com/a.jpg',
    photoStoragePath: childPhotoPath('parent-1', 'child/2'),
  });
  assert.deepEqual(patch, {
    name: 'Adam',
    displayName: 'Adam',
    bio: 'Year 4',
    avatarUrl: 'https://example.com/a.jpg',
    photoStoragePath: 'media/parent-1/child-child2.jpg',
  });
  for (const field of PRIVILEGED_PROFILE_FIELDS) assert.equal(field in patch, false, field);
});

test('child controls clamp screen time and Sparks, and a card keeps four digits', () => {
  const controls = normaliseChildControls({
    childId: 'child-1',
    screenTimeMinutes: 9000,
    sparksDailyLimit: -4,
    teacherMessages: 'digest',
    purchaseApproval: true,
    weeklyReportEmail: false,
    weeklyReportInApp: true,
  });
  assert.equal(controls.screenTimeMinutes, 1440);
  assert.equal(controls.sparksDailyLimit, 0);
  assert.equal(controls.teacherMessages, 'digest');
  assert.deepEqual(reportChannels(controls), { email: false, inApp: true });
  assert.equal(withinSparksLimit(40, 20, 50), false);
  assert.equal(withinSparksLimit(10, 20, 50), true);
  assert.equal(withinScreenTime(30, 120), true);
  assert.equal(withinScreenTime(130, 120), false);
  const card = normalisePaymentMethod({
    brand: 'Visa',
    last4: 'ACCT-4242',
    expiry: '12/28',
    holder: ' Sara Rahman ',
  });
  assert.deepEqual(card, { brand: 'Visa', last4: '4242', expiry: '12/28', holder: 'Sara Rahman' });
  assert.equal(normalisePaymentMethod({ brand: 'Visa', last4: '12', expiry: '13-28', holder: 'Sara' }).expiry, '');
});

test('the strictest linked parent decides purchase approval and spending', () => {
  const loose = defaultChildControls('child-1');
  const tight = normaliseChildControls({
    childId: 'child-1',
    screenTimeMinutes: 30,
    sparksDailyLimit: 10,
    purchaseApproval: false,
    weeklyReportEmail: true,
    weeklyReportInApp: false,
    teacherMessages: 'off',
  });
  const merged = strictestControls([loose, tight]);
  assert.equal(merged?.screenTimeMinutes, 30);
  assert.equal(merged?.sparksDailyLimit, 10);
  assert.equal(merged?.purchaseApproval, true);
  assert.equal(merged?.teacherMessages, 'off');
  assert.equal(purchaseNeedsParent(merged), true);
  assert.equal(purchaseNeedsParent(null), false);
});

test('linking a child is no longer a general profile field', () => {
  assert.equal((SELF_SERVICE_FIELDS as readonly string[]).includes('childIds'), false);
});
