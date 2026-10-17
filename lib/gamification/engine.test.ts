import assert from 'node:assert/strict';
import test from 'node:test';
import { LEARNING_EVENTS, isClientLearningEvent } from '@/lib/events';
import { DEFAULT_SPARKS, badgeIcon, levelForXp, mergeDefinitions } from '@/lib/gamification/catalog';
import { linkedInAddToProfile, linkedInShareOffsite, publicBadgeUrl } from '@/lib/gamification/share';
import {
  boardLabel,
  classBoards,
  emptyGameState,
  evaluateEvent,
  isoWeekKey,
  leaderboardRows,
  rankHouses,
} from '@/lib/gamification/engine';
import { exportAchievementBadge } from '@/lib/gamification/open-badge-export';

const day = '2026-10-16';

test('a first unit-test pass awards XP once', () => {
  const first = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.unitTestPass,
    day,
    eventId: 'pass-1',
    payload: { unitId: 'algebra-1' },
  });
  assert.equal(first.xpGained >= 40, true);
  assert.equal(first.badges.some(badge => badge.id === 'first-unit-pass'), true);
  const again = evaluateEvent(first.state, {
    event: LEARNING_EVENTS.unitTestPass,
    day,
    eventId: 'pass-2',
    payload: { unitId: 'algebra-1', retake: true },
  });
  assert.equal(again.xpGained, 0);
  assert.equal(again.skipped, 'retake');
  assert.equal(again.badges.length, 0);
  assert.equal(again.state.awarded.filter(id => id === 'first-unit-pass').length, 1);
});

test('the same event id does not award twice', () => {
  const first = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.lessonFirstComplete,
    day,
    eventId: 'lesson-1',
  });
  const again = evaluateEvent(first.state, {
    event: LEARNING_EVENTS.lessonFirstComplete,
    day,
    eventId: 'lesson-1',
  });
  assert.equal(again.skipped, 'duplicate');
  assert.equal(again.xpGained, 0);
});

test('integrity holds block XP and badges', () => {
  const result = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.unitTestPerfect,
    day,
    payload: { unitId: 'algebra-1', integrity: 'flagged' },
  });
  assert.equal(result.skipped, 'integrity');
  assert.equal(result.xpGained, 0);
  assert.equal(result.state.integrityFlags, 1);
  assert.equal(result.badges.length, 0);
});

test('ET AI questions need substance, then count toward the badge', () => {
  const empty = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.etAiQuestion,
    day,
    payload: { question: 'hi' },
  });
  assert.equal(empty.xpGained, 0);
  let state = emptyGameState();
  for (let i = 0; i < 10; i += 1) {
    const step = evaluateEvent(state, {
      event: LEARNING_EVENTS.etAiQuestion,
      day,
      eventId: `q-${i}`,
      payload: { question: 'How do I add fractions?' },
    });
    state = step.state;
  }
  assert.equal(state.xp >= 20, true);
  assert.equal(state.awarded.includes('et-10'), true);
});

test('streaks earn a freeze that is spent, not bought', () => {
  let state = emptyGameState();
  for (let i = 0; i < 7; i += 1) {
    const date = `2026-10-${String(10 + i).padStart(2, '0')}`;
    state = evaluateEvent(state, { event: LEARNING_EVENTS.streakDay, day: date, eventId: `s-${i}` }).state;
  }
  assert.equal(state.streak, 7);
  assert.equal(state.freezes, 1);
  assert.equal(state.awarded.includes('streak-3'), true);
  assert.equal(state.awarded.includes('streak-7'), true);
  const missed = evaluateEvent(state, { event: LEARNING_EVENTS.streakDay, day: '2026-10-18', eventId: 's-gap' });
  assert.equal(missed.freezeUsed, true);
  assert.equal(missed.state.streak, 8);
  assert.equal(missed.state.freezes, 0);
});

test('the daily cap stops further XP', () => {
  let state = emptyGameState();
  state.dailyXp[day] = 118;
  const result = evaluateEvent(state, {
    event: LEARNING_EVENTS.unitTestPass,
    day,
    payload: { unitId: 'unit-a' },
  });
  assert.equal(result.xpGained <= 2, true);
  assert.equal((result.state.dailyXp[day] ?? 0) <= 120, true);
});

test('Sparks stay off until a super admin configures a small grant', () => {
  const quiet = evaluateEvent(emptyGameState(), { event: LEARNING_EVENTS.onboardingComplete, day });
  assert.equal(quiet.sparks, 0);
  assert.deepEqual(DEFAULT_SPARKS, { enabled: false, amount: 0, badgeIds: [] });
  const paid = evaluateEvent(emptyGameState(), { event: LEARNING_EVENTS.onboardingComplete, day }, undefined, {
    enabled: true,
    amount: 2,
    badgeIds: ['onboarding-complete'],
  });
  assert.equal(paid.sparks, 2);
  const huge = evaluateEvent(emptyGameState(), { event: LEARNING_EVENTS.onboardingComplete, day }, undefined, {
    enabled: true,
    amount: 90,
    badgeIds: ['onboarding-complete'],
  });
  assert.equal(huge.sparks, 5);
});

test('comeback, early bird, and a cited research question each award once', () => {
  const comeback = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.unitTestComeback,
    day,
    payload: { unitId: 'algebra-1' },
  });
  assert.equal(comeback.badges.some(badge => badge.id === 'comeback'), true);
  const again = evaluateEvent(comeback.state, {
    event: LEARNING_EVENTS.unitTestComeback,
    day,
    payload: { unitId: 'algebra-1' },
  });
  assert.equal(again.xpGained, 0);
  const early = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.studySession,
    day,
    hour: 6,
    payload: { minutes: 15 },
  });
  assert.equal(early.badges.some(badge => badge.id === 'early-bird'), true);
  const noon = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.studySession,
    day,
    hour: 14,
    payload: { minutes: 15 },
  });
  assert.equal(noon.badges.some(badge => badge.id === 'early-bird'), false);
  const research = evaluateEvent(emptyGameState(), {
    event: LEARNING_EVENTS.researchHelperCited,
    day,
    payload: { citations: 2 },
  });
  assert.equal(research.badges.some(badge => badge.id === 'curious-researcher'), true);
});

test('levels use names and a click does not earn XP', () => {
  assert.equal(levelForXp(0).name, 'Seedling');
  assert.equal(levelForXp(500).name, 'Scholar');
  const click = evaluateEvent(emptyGameState(), { event: 'button.click', day });
  assert.equal(click.xpGained, 0);
  const grown = evaluateEvent(emptyGameState(70), { event: LEARNING_EVENTS.lessonFirstComplete, day });
  assert.equal(grown.leveledUp, true);
  assert.equal(grown.levelName, 'Explorer');
  assert.equal(grown.badges.some(badge => badge.id === 'level-up'), true);
});

test('boards show a short name and the school, and houses rank by XP', () => {
  assert.equal(boardLabel('Ada Lovelace', 'North Academy'), 'Ada L. · North Academy');
  assert.equal(boardLabel('ada@poketschool.ai', 'North Academy'), 'Learner · North Academy');
  const rows = leaderboardRows([
    { id: 'a', name: 'Ada Lovelace', school: 'North Academy', score: 10, shareBoard: true },
    { id: 'b', name: 'Grace Hopper', school: 'North Academy', score: 40, shareBoard: false },
  ], 'a');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, 'Ada L. · North Academy');
  const houses = rankHouses([
    { houseId: 'oak', houseName: 'Oak', xp: 10, shareBoard: true },
    { houseId: 'oak', houseName: 'Oak', xp: 5, shareBoard: true },
    { houseId: 'elm', houseName: 'Elm', xp: 30, shareBoard: true },
    { houseId: 'elm', houseName: 'Elm', xp: 100, shareBoard: false },
  ]);
  assert.equal(houses[0]?.houseId, 'elm');
  assert.equal(houses[0]?.xp, 30);
  assert.equal(houses[1]?.houseId, 'oak');
  assert.equal(houses[1]?.xp, 15);
});

test('class competitions stay off until turned on', () => {
  assert.deepEqual(classBoards(null), { leaderboardEnabled: true, competitionsEnabled: false });
  assert.equal(classBoards({ competitionsEnabled: true }).competitionsEnabled, true);
  assert.equal(isoWeekKey('2026-01-01').startsWith('2026-W'), true);
});

test('catalogue icon replaces a legacy art field', () => {
  assert.equal(badgeIcon({ art: 'flame' }), 'flame');
  assert.equal(badgeIcon({ icon: 'book', art: 'flame' }), 'book');
  const merged = mergeDefinitions([{ id: 'first-lesson', art: 'flame' }]);
  const badge = merged.find(item => item.id === 'first-lesson');
  assert.equal(badge?.icon, 'flame');
  assert.equal('art' in (badge ?? {}), false);
});

test('clients cannot post the first-lesson event', () => {
  assert.equal(isClientLearningEvent(LEARNING_EVENTS.lessonFirstComplete), false);
  assert.equal(isClientLearningEvent(LEARNING_EVENTS.unitTestPass), true);
});

test('LinkedIn share points at the public badge page', () => {
  const page = publicBadgeUrl('learner_first-lesson');
  assert.equal(page, 'https://poketschool.ai/badges/learner_first-lesson');
  assert.equal(
    linkedInShareOffsite(page),
    'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fpoketschool.ai%2Fbadges%2Flearner_first-lesson',
  );
  const add = linkedInAddToProfile({
    name: 'First lesson',
    awardId: 'learner_first-lesson',
    pageUrl: page,
    issuedAt: '2026-10-16T00:00:00.000Z',
  });
  assert.equal(add.includes('linkedin.com/profile/add'), true);
  assert.equal(add.includes('organizationName=Poket+School'), true);
  assert.equal(add.includes('certUrl='), true);
  assert.equal(add.includes('OPEN_BADGE'), false);
});

test('Open Badges export stays unsigned without a private key', () => {
  const badge = {
    id: 'first-lesson',
    name: 'First lesson',
    description: 'Finish your first lesson.',
    icon: 'lesson',
    tier: 'bronze' as const,
    audience: 'student' as const,
    criteria: { type: 'once' as const, event: LEARNING_EVENTS.lessonFirstComplete },
    enabled: true,
  };
  const plain = exportAchievementBadge(badge, 'Ada L.', '2026-10-16T00:00:00.000Z', 'badge-1');
  assert.equal(plain.proof, undefined);
  assert.equal((plain.type as string[]).includes('OpenBadgeCredential'), true);
  const broken = exportAchievementBadge(badge, 'Ada L.', '2026-10-16T00:00:00.000Z', 'badge-1', 'not-a-key');
  assert.equal(broken.proof, undefined);
});
