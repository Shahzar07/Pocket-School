import assert from 'node:assert/strict';
import test from 'node:test';
import { DESK_ADDRESS, deskAddress, deskNeedsEscalation, deskRecipients, onCallAt, type RotaSlot } from './policy';

const slots: RotaSlot[] = [
  { weekday: 1, startMinutes: 8 * 60, endMinutes: 17 * 60, primaryUid: 'primary', backupUid: 'backup' },
];

test('people without a school are addressed to the Safety Desk', () => {
  assert.equal(deskAddress('', 'safeguarding_lead'), DESK_ADDRESS);
  assert.equal(deskAddress('school-1', 'safeguarding_lead'), 'safeguarding_lead');
});

test('the rota names primary and backup, and escalation waits past five minutes', () => {
  assert.deepEqual(onCallAt(slots, 1, 9 * 60), { primaryUid: 'primary', backupUid: 'backup' });
  assert.equal(onCallAt(slots, 2, 9 * 60).primaryUid, '');
  const created = 1_000;
  assert.equal(deskNeedsEscalation(created, 0, 0, created + 5 * 60 * 1000), false);
  assert.equal(deskNeedsEscalation(created, 0, 0, created + 5 * 60 * 1000 + 1), true);
  assert.equal(deskNeedsEscalation(created, 2, 0, created + 6 * 60 * 1000), false);
  const quiet = deskRecipients({
    superAdminUids: ['admin-1'],
    primaryUid: 'primary',
    backupUid: 'backup',
    guardianUids: ['parent-1'],
    excludedParentUids: ['parent-1'],
    escalate: false,
  });
  assert.deepEqual(quiet, ['admin-1', 'primary']);
  const escalated = deskRecipients({
    superAdminUids: ['admin-1'],
    primaryUid: 'primary',
    backupUid: 'backup',
    guardianUids: ['parent-1'],
    excludedParentUids: [],
    escalate: true,
  });
  assert.deepEqual(escalated, ['admin-1', 'primary', 'backup', 'parent-1']);
});
