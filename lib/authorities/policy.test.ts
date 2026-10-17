import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALERT_AUTHORITY_REMINDER_MS,
  TICKET_AUTHORITY_REMINDER_MS,
  applyAuthorityUpdate,
  authorityOverdue,
  authorityShareReady,
  canCloseTicket,
  initialAuthorities,
} from './policy';

const blank = { required: 'unsure' as const, reason: '', status: 'to_be_informed' as const, informed: null };

test('no needs a reason, and a ticket cannot close while authorities are still to be informed', () => {
  assert.equal('error' in initialAuthorities('no', 'no'), true);
  const skipped = initialAuthorities('no', 'The family asked the school to handle it.');
  assert.equal('decision' in skipped && skipped.decision.status, 'not_required');
  const waiting = initialAuthorities('yes', '');
  assert.equal('decision' in waiting && waiting.decision.status, 'to_be_informed');
  assert.equal(canCloseTicket('to_be_informed'), false);
  assert.equal(canCloseTicket('not_required'), true);
  assert.equal(canCloseTicket('informed'), true);
  assert.equal(authorityShareReady('to_be_informed'), false);
  assert.equal(authorityShareReady('informed'), true);
  assert.equal(authorityShareReady('acknowledged'), true);
  assert.equal(authorityShareReady('closed_by_authority'), true);
});

test('informing records the agency, and reminders are one hour for alerts and four for tickets', () => {
  const informed = applyAuthorityUpdate(blank, {
    status: 'informed',
    reason: '',
    agency: 'Royal Malaysia Police',
    contact: '999',
    reference: 'PDRM-1',
    by: 'principal',
    at: 10,
  });
  assert.equal('decision' in informed && informed.decision.status, 'informed');
  assert.equal('decision' in informed && informed.decision.informed?.contact, '999');
  const early = applyAuthorityUpdate(blank, {
    status: 'acknowledged',
    reason: '',
    agency: '',
    contact: '',
    reference: '',
    by: 'principal',
    at: 10,
  });
  assert.equal('error' in early, true);
  const created = 1_000;
  assert.equal(authorityOverdue(created, 'to_be_informed', created + ALERT_AUTHORITY_REMINDER_MS, ALERT_AUTHORITY_REMINDER_MS, 0), true);
  assert.equal(authorityOverdue(created, 'to_be_informed', created + TICKET_AUTHORITY_REMINDER_MS - 1, TICKET_AUTHORITY_REMINDER_MS, 0), false);
  assert.equal(authorityOverdue(created, 'informed', created + TICKET_AUTHORITY_REMINDER_MS, TICKET_AUTHORITY_REMINDER_MS, 0), false);
});
