import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeScreen, screenContent } from './screen';
import { muteActive, nextStrike } from './strikes';
import { alertCopy, detectPatterns, parentReceives, planAlert, redactExcerpt, shouldEscalate } from './safeguard';

const now = Date.UTC(2026, 9, 17, 12, 0, 0);

test('clean schoolwork is published', () => {
  const result = screenContent({ text: 'I finally understood simultaneous equations.', surface: 'class_space', ageTier: 'teen' });
  assert.equal(result.decision, 'allow');
  assert.equal(result.safeguarding, false);
});

test('self-harm is blocked with a supportive note and a critical alert', () => {
  const minor = screenContent({ text: 'I want to die', surface: 'class_space', ageTier: 'teen' });
  assert.equal(minor.decision, 'block');
  assert.equal(minor.severity, 'critical');
  assert.match(minor.supportiveMessage ?? '', /safeguarding/);
  const adult = screenContent({ text: 'I want to die', surface: 'network_post', ageTier: 'adult' });
  assert.match(adult.supportiveMessage ?? '', /Befrienders/);
  assert.equal(adult.severity, 'critical');
});

test('minors get a stricter harassment result and adults are held', () => {
  const minor = screenContent({ text: 'you are so stupid', surface: 'class_space', ageTier: 'under13' });
  assert.equal(minor.decision, 'block');
  assert.match(minor.authorMessage, /community guidelines/);
  const adult = screenContent({ text: 'you are so stupid', surface: 'network_post', ageTier: 'adult' });
  assert.equal(adult.decision, 'hold');
});

test('personal data, grooming, hate, and investment pitches are stopped', () => {
  assert.equal(screenContent({ text: 'email me at ada@school.edu', surface: 'network_post', ageTier: 'adult' }).category, 'personal_data');
  const groom = screenContent({ text: 'message me on whatsapp and keep it secret', surface: 'class_space', ageTier: 'teen' });
  assert.equal(groom.decision, 'block');
  assert.equal(groom.severity, 'high');
  assert.equal(screenContent({ text: 'I hate all of them, go back to your country', surface: 'network_post', ageTier: 'adult' }).category, 'hate');
  const pitch = screenContent({ text: 'Guaranteed returns if you invest in my startup', surface: 'founder_message', ageTier: 'adult' });
  assert.equal(pitch.category, 'investment_solicitation');
  assert.equal(pitch.decision, 'block');
});

test('an unseen image is held and a model cannot loosen a block', () => {
  const image = screenContent({ text: 'Our club photo', surface: 'group_post', ageTier: 'adult', hasImage: true });
  assert.equal(image.decision, 'hold');
  assert.equal(image.reasons.includes('image_unseen'), true);
  const local = screenContent({ text: 'I will kill you', surface: 'network_dm', ageTier: 'adult' });
  const merged = mergeScreen(local, { decision: 'allow', reasons: [] });
  assert.equal(merged.decision, 'block');
});

test('strikes escalate from a warning to a suspension', () => {
  const first = nextStrike(0, 'low', now);
  assert.equal(first.action, 'warning');
  const day = nextStrike(1, 'medium', now);
  assert.equal(day.action, 'mute_24h');
  assert.equal(muteActive(day.mutedUntilMs, false, now + 1000), true);
  const week = nextStrike(2, 'high', now);
  assert.equal(week.action, 'mute_7d');
  const suspended = nextStrike(3, 'high', now);
  assert.equal(suspended.action, 'suspend');
  assert.equal(suspended.suspended, true);
});

test('parents cannot switch off high alerts, and they never see the other child', () => {
  assert.equal(parentReceives('high', 'high', true), true);
  assert.equal(parentReceives('high', 'medium', true), false);
  assert.equal(parentReceives('all', 'high', false), false);
  const plan = planAlert({
    ageTier: 'teen',
    severity: 'critical',
    category: 'self_harm',
    parentLevel: 'high',
    tellTeacher: true,
    now: new Date(now),
    quietStart: '21:00',
    quietEnd: '07:00',
  });
  assert.equal(plan.bypassQuietHours, true);
  assert.equal(plan.escalateIfUnackedMs, 15 * 60 * 1000);
  assert.equal(plan.audiences.includes('author_parent'), true);
  assert.equal(plan.audiences.includes('safeguarding_lead'), true);
  const parent = alertCopy({
    audience: 'author_parent',
    childFirstName: 'Amina',
    otherLabel: 'Hidden',
    category: 'harassment',
    severity: 'medium',
    space: 'the class space',
    actionTaken: 'The post was removed.',
  });
  assert.equal(parent.body.includes('Hidden'), false);
  assert.match(redactExcerpt('please kill yourself tonight'), /removed/);
  assert.equal(shouldEscalate(null, now, 15 * 60 * 1000, now + 16 * 60 * 1000), true);
  assert.equal(shouldEscalate(now, now, 15 * 60 * 1000, now + 16 * 60 * 1000), false);
});

test('repeat targeting and pile-ons open a case even when one post is borderline', () => {
  const events = [1, 2, 3].map(index => ({
    authorId: 'a',
    targetIds: ['b'],
    category: 'borderline' as const,
    severity: 'low' as const,
    atMs: now - index * 1000,
    surface: 'class_space',
  }));
  const hits = detectPatterns(events, now);
  assert.equal(hits.some(hit => hit.kind === 'repeat_target'), true);
  const pile = detectPatterns([
    { authorId: 'a', targetIds: ['b'], category: 'harassment', severity: 'low', atMs: now, surface: 'class_space' },
    { authorId: 'c', targetIds: ['b'], category: 'harassment', severity: 'low', atMs: now, surface: 'class_space' },
    { authorId: 'd', targetIds: ['b'], category: 'harassment', severity: 'low', atMs: now, surface: 'class_space' },
  ], now);
  assert.equal(pile.some(hit => hit.kind === 'pile_on'), true);
});
