import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canOpenDesk,
  confirmBroadcast,
  decideSuspend,
  decideTierChange,
  hideSafeguardingIdentity,
  inDeskScope,
  recordAmberApproval,
  slaRemaining,
  visibleCaseTitle,
  type DeskActor,
} from './desk';

const superAdmin: DeskActor = {
  uid: 'super', role: 'admin', staffRole: 'super_admin', institutionId: '', region: '', country: 'MY', staffPost: '',
};
const admin: DeskActor = {
  uid: 'admin', role: 'admin', staffRole: 'admin', institutionId: 'school-a', region: 'Selangor', country: 'MY', staffPost: '',
};
const lead: DeskActor = { ...admin, staffPost: 'safeguarding_lead' };

test('a super admin sees every row and an admin stays inside institution or region', () => {
  assert.equal(canOpenDesk(superAdmin), true);
  assert.equal(canOpenDesk({ staffRole: null }), false);
  assert.equal(inDeskScope(superAdmin, { institutionId: 'school-b' }), true);
  assert.equal(inDeskScope(admin, { institutionId: 'school-a' }), true);
  assert.equal(inDeskScope(admin, { institutionId: 'school-b', region: 'Johor' }), false);
  assert.equal(inDeskScope(admin, { region: 'Selangor' }), true);
  assert.equal(inDeskScope({ ...admin, institutionId: '', region: '' }, { country: 'MY' }), true);
  assert.equal(inDeskScope({ ...admin, institutionId: '', region: '' }, {}), false);
});

test('an admin cannot see safeguarding names or change a super admin', () => {
  assert.equal(hideSafeguardingIdentity(admin), true);
  assert.equal(hideSafeguardingIdentity(lead), false);
  assert.equal(hideSafeguardingIdentity(superAdmin), false);
  assert.equal(visibleCaseTitle('Amina Yusuf', admin, true), 'Safeguarding case');
  assert.equal(visibleCaseTitle('Amina Yusuf', superAdmin, true), 'Amina Yusuf');
  const tier = decideTierChange({
    actor: admin,
    targetStaffRole: 'super_admin',
    targetInstitutionId: 'school-a',
    targetRegion: '',
    targetCountry: 'MY',
    nextTier: 4,
    reason: 'Checked the warrant card',
  });
  assert.equal(tier.ok, false);
  const suspend = decideSuspend({
    actor: admin,
    targetStaffRole: 'teacher',
    targetInstitutionId: 'school-b',
    targetRegion: 'Johor',
    targetCountry: 'MY',
    reason: 'Left the school',
  });
  assert.equal(suspend.ok, false);
});

test('Amber approval needs a reason and a second person', () => {
  const first = recordAmberApproval({ actorUid: 'a', reason: 'Photo matches the report', approvers: [] });
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.ready, false);
  const second = recordAmberApproval({ actorUid: 'b', reason: 'Second check', approvers: first.ok ? first.approvers : [] });
  assert.equal(second.ok && second.ready, true);
  assert.equal(recordAmberApproval({ actorUid: 'a', reason: '', approvers: [] }).ok, false);
});

test('a broadcast waits for SEND and a super admin', () => {
  assert.equal(confirmBroadcast({ actor: admin, category: 'safety', audience: 'MY', body: 'Drill', confirmation: 'SEND' }).ok, false);
  assert.equal(confirmBroadcast({ actor: superAdmin, category: 'safety', audience: 'MY', body: 'Drill', confirmation: 'send' }).ok, false);
  assert.equal(confirmBroadcast({ actor: superAdmin, category: 'safety', audience: 'MY', body: 'Drill', confirmation: 'SEND' }).ok, true);
});

test('an SLA timer says when a ticket is over', () => {
  const now = Date.UTC(2026, 9, 17, 12, 0, 0);
  assert.equal(slaRemaining(now - 5 * 60000, now).breached, true);
  assert.equal(slaRemaining(now + 5 * 60000, now).label, '5 min left');
});
