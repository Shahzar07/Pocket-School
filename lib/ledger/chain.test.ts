import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GENESIS,
  canManageLegalHold,
  internalRedactionBlocked,
  sealEntry,
  shareRefusal,
  verifyChain,
  type ChainEntry,
} from './chain';
import { exportCsv, exportPdf, verificationHash } from './export';

function entry(seq: number, prev: string, action: string): ChainEntry {
  return sealEntry(prev, {
    seq,
    actorUid: 'user-1',
    actorRole: 'admin',
    action,
    diff: { before: { status: 'pending' }, after: { status: action } },
    serverTimestamp: 1_700_000_000_000 + seq,
    device: { platform: 'web', appVersion: 'web', ipHash: 'abc' },
    stream: 'events',
  });
}

test('a chain verifies, and a changed field breaks it', () => {
  const first = entry(1, GENESIS, 'created');
  const second = entry(2, first.hash, 'status_change');
  assert.equal(verifyChain([second, first]).ok, true);
  assert.equal(verifyChain([first, second]).head, second.hash);
  const tampered = { ...second, diff: { before: second.diff.before, after: { status: 'closed' } } };
  assert.equal(verifyChain([first, tampered]).ok, false);
  assert.equal(verifyChain([first, tampered]).brokenAt, 2);
});

test('hotline tickets cannot be shared, and only an active public alert can', () => {
  assert.equal(shareRefusal('hotline', 'pending', false), 'Hotline tickets cannot be shared.');
  assert.equal(shareRefusal('alert', 'resolved', true), 'Only an active public alert can be shared.');
  assert.equal(shareRefusal('alert', 'active', false), 'This alert is not public.');
  assert.equal(shareRefusal('alert', 'updated', true), null);
});

test('legal hold is limited to the super admin and the principal', () => {
  assert.equal(canManageLegalHold('admin', ''), true);
  assert.equal(canManageLegalHold('teacher', 'principal'), true);
  assert.equal(canManageLegalHold('institution_admin', 'teacher'), false);
  assert.equal(internalRedactionBlocked({ on: true, by: 'admin', at: 1, reason: 'police' }), true);
  assert.equal(internalRedactionBlocked({ on: false, by: '', at: 0, reason: '' }), false);
});

test('the export verification hash is the file prefix, not the hash line', () => {
  const file = exportCsv('ticket-1', 'ticket', [entry(1, GENESIS, 'created')], 'head');
  const text = new TextDecoder().decode(file.body);
  const prefix = text.split('verificationHash,')[0] ?? '';
  assert.equal(verificationHash(prefix), file.verificationHash);
  assert.match(text, /chainHead,head/);
  const pdf = exportPdf('alert-1', 'alert', [entry(1, GENESIS, 'created')], 'head');
  assert.equal(new TextDecoder().decode(pdf.body).startsWith('%PDF-1.4'), true);
  assert.equal(pdf.verificationHash.length, 64);
});

test('server writers never update or delete append-only logs', () => {
  const root = new URL('../..', import.meta.url);
  const files = ['lib/server/ledger.ts', 'lib/server/hotline.ts', 'lib/server/emergency.ts', 'lib/server/staff-notify.ts'];
  const forbidden = [
    /\/events['"`]\)[\s\S]{0,120}\.(update|delete|set)\(/,
    /\/audit['"`]\)[\s\S]{0,120}\.(update|delete|set)\(/,
    /\/updates['"`]\)[\s\S]{0,120}\.(update|delete|set)\(/,
    /\/consent['"`]\)[\s\S]{0,160}\.(update|delete|set)\(/,
    /collection\(`[^`]+\/events`\)\.add\(/,
    /collection\(`[^`]+\/audit`\)\.add\(/,
    /collection\(`[^`]+\/updates`\)\.add\(/,
    /collection\(`[^`]+\/consent`\)\.add\(/,
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const pattern of forbidden) assert.equal(pattern.test(source), false, `${file} ${pattern}`);
  }
  const ledger = readFileSync(new URL('lib/server/ledger.ts', root), 'utf8');
  assert.match(ledger, /tx\.create\(entryRef/);
  assert.equal(ledger.includes('tx.delete'), false);
  assert.equal(ledger.includes('.delete('), false);
});
