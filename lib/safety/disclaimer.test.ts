import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  COMPANY_LEGAL_NAME,
  FULL_CLAUSES,
  PENDING_LEGAL_REVIEW,
  SAFETY_TERMS_STATUS,
  SAFETY_TERMS_TITLE,
  SHORT_BODY,
  UNDER_13_DISCLAIMER,
  UNGATED_EMERGENCY_ACTIONS,
  ackMatchesVersion,
  safetyActionRequiresAck,
  safetyDeskEmailText,
  safetyDeskSmsText,
  safetyMessageFooter,
  shortHeadline,
} from './disclaimer';

test('the draft keeps the legal-name placeholder, the review marker, and ten clauses', () => {
  assert.match(SAFETY_TERMS_TITLE, /pending legal review/);
  assert.equal(PENDING_LEGAL_REVIEW, 'DRAFT, pending legal review');
  assert.match(SAFETY_TERMS_STATUS, /pending legal review|Not live until Harry approves/);
  assert.equal(FULL_CLAUSES.length, 10);
  assert.match(FULL_CLAUSES[0], new RegExp(COMPANY_LEGAL_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(FULL_CLAUSES[0].includes('[COMPANY LEGAL NAME]'), true);
  assert.match(FULL_CLAUSES[9], /Laws of Malaysia/);
});

test('the short footer and the under-13 line are the supplied sentences', () => {
  assert.equal(shortHeadline('999'), 'Not an emergency service. In danger? Call 999 now.');
  assert.equal(UNDER_13_DISCLAIMER, "We help when we can, but we're not the police. If you're scared, call 999 or tell a grown-up now.");
  const footer = safetyMessageFooter('999');
  assert.match(footer, /Call 999 now/);
  assert.match(footer, new RegExp(SHORT_BODY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(footer, /https:\/\/poketschool\.ai\/safety-terms/);
  assert.match(safetyDeskEmailText('Confidential notice', '999'), /\/safety-terms/);
  assert.match(safetyDeskSmsText('Safety Desk', '999'), /\/safety-terms/);
  assert.match(safetyDeskSmsText('Safety Desk', '999'), /Not an emergency service/);
});

test('an acknowledgement matches only the current version', () => {
  assert.equal(ackMatchesVersion('2026-10-17'), true);
  assert.equal(ackMatchesVersion(''), false);
  assert.equal(ackMatchesVersion('2026-01-01'), false);
});

test('emergency actions are never gated by the disclaimer acknowledgement', () => {
  for (const action of UNGATED_EMERGENCY_ACTIONS) {
    assert.equal(safetyActionRequiresAck(action), false, action);
  }
  assert.equal(safetyActionRequiresAck('danger'), false);
  assert.equal(safetyActionRequiresAck('emergency_number'), false);
  assert.equal(safetyActionRequiresAck('roll_call_safe'), false);
  assert.equal(safetyActionRequiresAck('roll_call_need_help'), false);
  assert.equal(safetyActionRequiresAck('amber_receipt'), false);
  assert.equal(safetyActionRequiresAck('safety_report'), true);
  assert.equal(safetyActionRequiresAck('hotline'), true);
  assert.equal(safetyActionRequiresAck('support_chat'), true);
  assert.equal(safetyActionRequiresAck('school_notice'), true);

  const safetyRoute = readFileSync(new URL('../../app/api/safety/[action]/route.ts', import.meta.url), 'utf8');
  const reportAt = safetyRoute.indexOf("if (action === 'report')");
  const dangerAt = safetyRoute.indexOf("if (action === 'danger')");
  const reportBranch = safetyRoute.slice(reportAt, dangerAt);
  const dangerBranch = safetyRoute.slice(dangerAt, safetyRoute.indexOf('return NextResponse.json(data)', dangerAt));
  assert.match(reportBranch, /requireSafetyTerms/);
  assert.match(dangerBranch, /raiseDanger/);
  assert.equal(dangerBranch.includes('requireSafetyTerms'), false);

  const rollCall = readFileSync(new URL('../../app/api/all-staff/[action]/route.ts', import.meta.url), 'utf8');
  const checkIn = rollCall.slice(rollCall.indexOf("action === 'check-in'"), rollCall.indexOf("action === 'clear'"));
  assert.equal(checkIn.includes('requireSafetyTerms'), false);

  const amber = readFileSync(new URL('../../app/api/amber/opt-in/route.ts', import.meta.url), 'utf8');
  assert.equal(amber.includes('requireSafetyTerms'), false);

  const emergency = readFileSync(new URL('../server/emergency.ts', import.meta.url), 'utf8');
  assert.equal(emergency.includes('requireSafetyTerms'), false);

  const safetyLib = readFileSync(new URL('../server/safety.ts', import.meta.url), 'utf8');
  assert.equal(safetyLib.includes('requireSafetyTerms'), false);

  const hotline = readFileSync(new URL('../../app/api/hotline/[action]/route.ts', import.meta.url), 'utf8');
  const createAt = hotline.indexOf("action === 'create'");
  assert.match(hotline.slice(createAt, hotline.indexOf("action === 'comment'")), /requireSafetyTerms/);

  const page = readFileSync(new URL('../../app/safety-terms/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /FULL_CLAUSES/);
  assert.equal(page.includes('Implementation notes'), false);
  assert.match(page, /\[COMPANY LEGAL NAME\]|COMPANY_LEGAL_NAME|FULL_CLAUSES/);
});
