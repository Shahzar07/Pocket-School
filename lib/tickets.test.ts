import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalStatus, slaDue, slaHours, statusLabel, ticketNumber } from './tickets';

test('legacy ticket statuses read as pending and solved', () => {
  assert.equal(canonicalStatus('in_progress'), 'pending');
  assert.equal(canonicalStatus('resolved'), 'solved');
  assert.equal(statusLabel('kiv'), 'KIV');
});

test('ticket numbers and SLA follow the id and priority', () => {
  assert.equal(ticketNumber('abc123def456'), 'PS-DEF456');
  assert.equal(slaHours('urgent'), 4);
  assert.equal(slaDue(0, 'normal'), 48 * 60 * 60 * 1000);
});
