import assert from 'node:assert/strict';
import test from 'node:test';
import { coerceDailyGoal } from './goals';
import {
  expoShouldPrune,
  sendAttendanceAlert,
  sendDigest,
  sendFlagAlert,
  sendGoalParentAlert,
  tokensForRecipient,
  wantsCategory,
  webPushShouldPrune,
  type DeviceToken,
  type PushDeps,
  type PushMessage,
} from './push';

function token(overrides: Partial<DeviceToken> = {}): DeviceToken {
  return {
    userId: 'student-1',
    token: 'ExponentPushToken[abc]',
    platform: 'ios',
    provider: 'expo',
    deviceId: 'phone-1',
    prefs: {},
    ...overrides,
  };
}

function message(overrides: Partial<PushMessage> = {}): PushMessage {
  return {
    recipientUid: 'student-1',
    category: 'general',
    title: 'Hello',
    body: 'There',
    ...overrides,
  };
}

function deps(tokens: DeviceToken[], outcome: { ok: boolean; prune: boolean } = { ok: true, prune: false }) {
  const queried: string[] = [];
  const pruned: string[] = [];
  const sent: DeviceToken[] = [];
  const store: PushDeps = {
    store: {
      async listForUser(userId) {
        queried.push(userId);
        return tokens;
      },
      async deleteToken(deviceId) {
        pruned.push(deviceId);
      },
    },
    send: async (device) => {
      sent.push(device);
      return outcome;
    },
  };
  return { store, queried, pruned, sent };
}

test('senders query deviceTokens for the recipient and follow the provider', async () => {
  const goal = deps([token({ userId: 'parent-1', deviceId: 'p1' })]);
  await sendGoalParentAlert(message({ recipientUid: 'parent-1', category: 'goals' }), goal.store);
  const flag = deps([token({ provider: 'webpush', deviceId: 'web-1' })]);
  await sendFlagAlert(message({ category: 'flags' }), flag.store);
  const attendance = deps([token({ deviceId: 'a1' })]);
  await sendAttendanceAlert(message({ category: 'attendance' }), attendance.store);
  const digest = deps([token({ userId: 'parent-2', deviceId: 'd1' })]);
  await sendDigest(message({ recipientUid: 'parent-2', category: 'digests' }), digest.store);

  assert.deepEqual(goal.queried, ['parent-1']);
  assert.equal(flag.sent[0]?.provider, 'webpush');
  assert.deepEqual(attendance.queried, ['student-1']);
  assert.deepEqual(digest.queried, ['parent-2']);
});

test('prefs opt out a device and invalid tokens are pruned', async () => {
  const quiet = token({ deviceId: 'quiet', prefs: { goals: false } });
  const live = token({ deviceId: 'live', token: 'ExponentPushToken[live]' });
  const other = token({ userId: 'someone-else', deviceId: 'other' });
  const goal = deps([quiet, live, other]);
  const report = await sendGoalParentAlert(message({ category: 'goals' }), goal.store);
  assert.deepEqual(goal.sent.map(item => item.deviceId), ['live']);
  assert.equal(report.skipped, 1);
  assert.equal(report.sent, 1);

  const dead = deps([token({ deviceId: 'gone' })], { ok: false, prune: true });
  const pruned = await sendFlagAlert(message({ category: 'flags' }), dead.store);
  assert.deepEqual(pruned.pruned, ['gone']);
  assert.deepEqual(dead.pruned, ['gone']);
});

test('provider errors that mean the token is dead are pruned', () => {
  assert.equal(expoShouldPrune({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }), true);
  assert.equal(expoShouldPrune({ data: { status: 'ok' } }), false);
  assert.equal(webPushShouldPrune(410), true);
  assert.equal(webPushShouldPrune(404), true);
  assert.equal(webPushShouldPrune(500), false);
  assert.equal(wantsCategory(token({ prefs: { digests: false } }), 'digests'), false);
  assert.equal(wantsCategory(token({ prefs: { achievements: false } }), 'achievements'), false);
  assert.equal(wantsCategory(token(), 'achievements'), true);
  assert.equal(wantsCategory(token(), 'attendance'), true);
  assert.equal(wantsCategory(token({ prefs: { safety: false } }), 'safety'), false);
  assert.equal(wantsCategory(token(), 'network'), true);
  assert.equal(tokensForRecipient([token({ userId: 'a' }), token({ userId: 'b' })], 'a').length, 1);
});

test('goals stay readable when the app uses the shared DailyGoal fields or an alias', () => {
  const canonical = coerceDailyGoal('g1', {
    studentId: 'student-1',
    dateKey: '2026-10-15',
    title: 'Read chapter 2',
    category: 'reading',
    estimateMinutes: 25,
    deadline: '18:00',
    status: 'not_started',
  });
  assert.equal(canonical?.title, 'Read chapter 2');
  assert.equal(canonical?.category, 'reading');

  const alias = coerceDailyGoal('g2', {
    userId: 'student-1',
    date: '2026-10-15',
    title: 'Practice',
    completed: true,
    minutes: 15,
    due: '19:30',
  });
  assert.equal(alias?.studentId, 'student-1');
  assert.equal(alias?.dateKey, '2026-10-15');
  assert.equal(alias?.status, 'completed');
  assert.equal(alias?.estimateMinutes, 15);
  assert.equal(alias?.deadline, '19:30');
  assert.equal(coerceDailyGoal('g3', { title: 'No owner' }), null);
});
