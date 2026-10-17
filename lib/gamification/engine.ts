import { isLearningEvent, LEARNING_EVENTS, type LearningEventName } from '@/lib/events';
import { publicLabel } from '@/lib/platform/privacy-board';
import {
  DEFAULT_SPARKS,
  GLOBAL_DAILY_XP_CAP,
  QUESTS,
  SPARKS_AMOUNT_MAX,
  STARTER_BADGES,
  XP_RULES,
  levelForXp,
  mergeDefinitions,
  type BadgeDefinition,
  type BadgeDefinitionInput,
  type QuestDefinition,
  type SparksRewardConfig,
} from '@/lib/gamification/catalog';

export interface GameState {
  xp: number;
  awarded: string[];
  counts: Record<string, number>;
  metrics: Record<string, number>;
  dailyXp: Record<string, number>;
  weeklyXp: Record<string, number>;
  dailyEvent: Record<string, number>;
  passedUnits: string[];
  comebacks: string[];
  books: string[];
  weeks: string[];
  seen: string[];
  streak: number;
  lastStudyDate: string;
  freezes: number;
  freezeGrants: string[];
  quests: Record<string, number>;
  questsDone: string[];
  integrityFlags: number;
  sparksPaid: string[];
}

export interface GameEvent {
  event: string;
  eventId?: string;
  /** Calendar day `YYYY-MM-DD` in the learner's zone. The caller supplies it. */
  day: string;
  hour?: number;
  payload?: Record<string, unknown>;
}

export interface Evaluation {
  state: GameState;
  xpGained: number;
  badges: BadgeDefinition[];
  levelName: string;
  leveledUp: boolean;
  questsCompleted: QuestDefinition[];
  sparks: number;
  freezeEarned: number;
  freezeUsed: boolean;
  skipped: 'duplicate' | 'integrity' | 'retake' | 'empty' | null;
  celebrate: boolean;
}

export function emptyGameState(xp = 0): GameState {
  return {
    xp: Math.max(0, Math.floor(xp)),
    awarded: [],
    counts: {},
    metrics: {},
    dailyXp: {},
    weeklyXp: {},
    dailyEvent: {},
    passedUnits: [],
    comebacks: [],
    books: [],
    weeks: [],
    seen: [],
    streak: 0,
    lastStudyDate: '',
    freezes: 0,
    freezeGrants: [],
    quests: {},
    questsDone: [],
    integrityFlags: 0,
    sparksPaid: [],
  };
}

export function isoWeekKey(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const current = new Date(Date.UTC(year || 1970, (month || 1) - 1, date || 1));
  const dayNr = (current.getUTCDay() + 6) % 7;
  const thursday = new Date(current);
  thursday.setUTCDate(current.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dayGap(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 99;
  return Math.round((end - start) / 86400000);
}

function meaningful(event: LearningEventName, payload: Record<string, unknown>): boolean {
  if (event === LEARNING_EVENTS.etAiQuestion) {
    return payload.substantive === true || text(payload.question).length >= 8;
  }
  if (event === LEARNING_EVENTS.studySession) return numberOf(payload.minutes) >= 10;
  if (event === LEARNING_EVENTS.researchHelperCited) {
    return payload.cited === true || numberOf(payload.citations) > 0;
  }
  if (event === LEARNING_EVENTS.peerHelp) return text(payload.helpedUserId).length > 0;
  if (event === LEARNING_EVENTS.readsBookFinished) return text(payload.bookId).length > 0;
  if (event === LEARNING_EVENTS.plannerWeekKept) return text(payload.weekKey).length > 0;
  if (event === LEARNING_EVENTS.institutionActiveStudents) return numberOf(payload.activeStudents) > 0;
  return true;
}

function integrityHeld(payload: Record<string, unknown>): boolean {
  const flag = text(payload.integrity);
  return flag === 'flagged' || flag === 'failed' || flag === 'held';
}

function criteriaMet(badge: BadgeDefinition, state: GameState, event: LearningEventName, payload: Record<string, unknown>, hour: number | undefined): boolean {
  const rule = badge.criteria;
  if (rule.type === 'xp') return state.xp >= rule.atLeast;
  if (rule.type === 'streak') return state.streak >= rule.days;
  if (rule.type === 'once') return rule.event === event;
  if (rule.type === 'count') return (state.counts[rule.event] ?? 0) >= rule.atLeast;
  if (rule.type === 'metric') return rule.event === event && numberOf(payload[rule.field] ?? state.metrics[rule.field]) >= rule.atLeast;
  if (rule.type === 'hour') {
    return rule.event === event && typeof hour === 'number' && hour >= rule.from && hour < rule.to;
  }
  return false;
}

function sparksFor(config: SparksRewardConfig, badgeIds: string[], already: string[]): number {
  if (!config.enabled) return 0;
  const amount = Math.max(0, Math.min(SPARKS_AMOUNT_MAX, Math.floor(config.amount)));
  if (amount <= 0 || config.badgeIds.length === 0) return 0;
  const fresh = badgeIds.filter(id => config.badgeIds.includes(id) && !already.includes(id));
  return fresh.length * amount;
}

export function evaluateEvent(
  state: GameState,
  input: GameEvent,
  definitions: readonly BadgeDefinition[] = STARTER_BADGES,
  sparks: SparksRewardConfig = DEFAULT_SPARKS,
): Evaluation {
  const base = {
    state,
    xpGained: 0,
    badges: [] as BadgeDefinition[],
    levelName: levelForXp(state.xp).name,
    leveledUp: false,
    questsCompleted: [] as QuestDefinition[],
    sparks: 0,
    freezeEarned: 0,
    freezeUsed: false,
    skipped: null as Evaluation['skipped'],
    celebrate: false,
  };
  if (!isLearningEvent(input.event)) return { ...base, skipped: 'empty' };
  const event = input.event;
  const payload = input.payload ?? {};
  const eventId = text(input.eventId);
  if (eventId && state.seen.includes(eventId)) return { ...base, skipped: 'duplicate' };
  if (integrityHeld(payload)) {
    return {
      ...base,
      skipped: 'integrity',
      state: { ...state, integrityFlags: state.integrityFlags + 1, seen: remember(state.seen, eventId) },
    };
  }
  if (!meaningful(event, payload)) return { ...base, skipped: 'empty', state: { ...state, seen: remember(state.seen, eventId) } };

  const next = cloneState(state);
  next.seen = remember(next.seen, eventId);
  let skipped: Evaluation['skipped'] = null;
  let freezeUsed = false;
  let freezeEarned = 0;

  if (event === LEARNING_EVENTS.streakDay || event === LEARNING_EVENTS.studySession) {
    const moved = moveStreak(next, input.day);
    freezeUsed = moved.used;
    freezeEarned = grantFreezes(next);
  }

  const unitId = text(payload.unitId);
  const retake = event === LEARNING_EVENTS.unitTestPass || event === LEARNING_EVENTS.unitTestPerfect
    ? payload.retake === true || (unitId.length > 0 && next.passedUnits.includes(unitId))
    : false;
  if (event === LEARNING_EVENTS.unitTestComeback && unitId && next.comebacks.includes(unitId)) {
    return { ...base, skipped: 'duplicate', state: next };
  }
  const bookId = text(payload.bookId);
  if (event === LEARNING_EVENTS.readsBookFinished && next.books.includes(bookId)) {
    return { ...base, skipped: 'duplicate', state: next };
  }
  const weekKey = text(payload.weekKey);
  if (event === LEARNING_EVENTS.plannerWeekKept && next.weeks.includes(weekKey)) {
    return { ...base, skipped: 'duplicate', state: next };
  }

  if (event === LEARNING_EVENTS.institutionActiveStudents) {
    next.metrics.activeStudents = Math.max(next.metrics.activeStudents ?? 0, numberOf(payload.activeStudents));
  }

  let xp = 0;
  if (!retake && event !== LEARNING_EVENTS.levelUp) {
    xp = xpFor(next, event, input.day);
  } else if (retake) {
    skipped = 'retake';
  }
  if (event === LEARNING_EVENTS.unitTestPass && unitId && !next.passedUnits.includes(unitId) && !retake) {
    next.passedUnits = [...next.passedUnits, unitId].slice(-200);
  }
  if (event === LEARNING_EVENTS.unitTestComeback && unitId) next.comebacks = [...next.comebacks, unitId].slice(-200);
  if (event === LEARNING_EVENTS.readsBookFinished) next.books = [...next.books, bookId].slice(-200);
  if (event === LEARNING_EVENTS.plannerWeekKept) next.weeks = [...next.weeks, weekKey].slice(-80);

  const counted = !retake;
  if (counted) next.counts[event] = (next.counts[event] ?? 0) + 1;
  if (xp > 0) {
    next.xp += xp;
    next.dailyXp[input.day] = (next.dailyXp[input.day] ?? 0) + xp;
    const weekKey = isoWeekKey(input.day);
    next.weeklyXp[weekKey] = (next.weeklyXp[weekKey] ?? 0) + xp;
    const eventKey = `${input.day}:${event}`;
    next.dailyEvent[eventKey] = (next.dailyEvent[eventKey] ?? 0) + 1;
  }

  const questsCompleted = advanceQuests(next, event, input.day, counted && !retake);
  let questXp = 0;
  for (const quest of questsCompleted) {
    const room = Math.max(0, GLOBAL_DAILY_XP_CAP - (next.dailyXp[input.day] ?? 0));
    const grant = Math.min(quest.xp, room);
    questXp += grant;
    next.xp += grant;
    next.dailyXp[input.day] = (next.dailyXp[input.day] ?? 0) + grant;
    const weekKey = isoWeekKey(input.day);
    next.weeklyXp[weekKey] = (next.weeklyXp[weekKey] ?? 0) + grant;
  }

  const before = levelForXp(state.xp).level;
  const after = levelForXp(next.xp);
  const leveledUp = after.level > before;
  if (leveledUp) next.counts[LEARNING_EVENTS.levelUp] = (next.counts[LEARNING_EVENTS.levelUp] ?? 0) + 1;

  const badges = awardBadges(next, definitions, event, payload, input.hour, leveledUp);
  const paid = sparksFor(sparks, badges.map(badge => badge.id), next.sparksPaid);
  if (paid > 0) next.sparksPaid = [...next.sparksPaid, ...badges.map(badge => badge.id)];

  return {
    state: next,
    xpGained: xp + questXp,
    badges,
    levelName: levelForXp(next.xp).name,
    leveledUp,
    questsCompleted,
    sparks: paid,
    freezeEarned,
    freezeUsed,
    skipped,
    celebrate: badges.length > 0 || leveledUp || questsCompleted.length > 0,
  };
}

function xpFor(state: GameState, event: LearningEventName, day: string): number {
  const rule = XP_RULES[event];
  if (!rule) return 0;
  const used = state.dailyEvent[`${day}:${event}`] ?? 0;
  if (used >= rule.dailyCap) return 0;
  const room = GLOBAL_DAILY_XP_CAP - (state.dailyXp[day] ?? 0);
  if (room <= 0) return 0;
  return Math.min(rule.xp, room);
}

function moveStreak(state: GameState, day: string): { used: boolean } {
  if (!state.lastStudyDate) {
    state.streak = 1;
    state.lastStudyDate = day;
    return { used: false };
  }
  if (state.lastStudyDate === day) return { used: false };
  const gap = dayGap(state.lastStudyDate, day);
  if (gap === 1) {
    state.streak += 1;
    state.lastStudyDate = day;
    return { used: false };
  }
  if (gap === 2 && state.freezes > 0) {
    state.freezes -= 1;
    state.streak += 1;
    state.lastStudyDate = day;
    return { used: true };
  }
  state.streak = 1;
  state.lastStudyDate = day;
  return { used: false };
}

function grantFreezes(state: GameState): number {
  let earned = 0;
  if (state.streak >= 7 && !state.freezeGrants.includes('streak-7') && state.freezes < 2) {
    state.freezes += 1;
    state.freezeGrants = [...state.freezeGrants, 'streak-7'];
    earned += 1;
  }
  if (state.streak >= 30 && !state.freezeGrants.includes('streak-30') && state.freezes < 2) {
    state.freezes += 1;
    state.freezeGrants = [...state.freezeGrants, 'streak-30'];
    earned += 1;
  }
  return earned;
}

function advanceQuests(state: GameState, event: LearningEventName, day: string, count: boolean): QuestDefinition[] {
  if (!count) return [];
  const week = isoWeekKey(day);
  const done: QuestDefinition[] = [];
  for (const quest of QUESTS) {
    if (quest.event !== event) continue;
    const period = quest.cadence === 'daily' ? day : week;
    const key = `${quest.id}:${period}`;
    if (state.questsDone.includes(key)) continue;
    const progress = (state.quests[key] ?? 0) + 1;
    state.quests[key] = progress;
    if (progress >= quest.target) {
      state.questsDone = [...state.questsDone, key].slice(-120);
      done.push(quest);
    }
  }
  return done;
}

function awardBadges(
  state: GameState,
  definitions: readonly BadgeDefinition[],
  event: LearningEventName,
  payload: Record<string, unknown>,
  hour: number | undefined,
  leveledUp: boolean,
): BadgeDefinition[] {
  const fresh: BadgeDefinition[] = [];
  for (const badge of definitions) {
    if (!badge.enabled || state.awarded.includes(badge.id)) continue;
    const met = criteriaMet(badge, state, event, payload, hour)
      || (leveledUp && badge.criteria.type === 'once' && badge.criteria.event === LEARNING_EVENTS.levelUp);
    if (!met) continue;
    state.awarded = [...state.awarded, badge.id];
    fresh.push(badge);
  }
  return fresh;
}

function remember(seen: string[], eventId: string): string[] {
  if (!eventId) return seen;
  return [...seen, eventId].slice(-80);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    awarded: [...state.awarded],
    counts: { ...state.counts },
    metrics: { ...state.metrics },
    dailyXp: { ...state.dailyXp },
    weeklyXp: { ...state.weeklyXp },
    dailyEvent: { ...state.dailyEvent },
    passedUnits: [...state.passedUnits],
    comebacks: [...state.comebacks],
    books: [...state.books],
    weeks: [...state.weeks],
    seen: [...state.seen],
    freezeGrants: [...state.freezeGrants],
    quests: { ...state.quests },
    questsDone: [...state.questsDone],
    sparksPaid: [...state.sparksPaid],
  };
}

export interface BoardPerson {
  id: string;
  name?: string | null;
  school?: string | null;
  score: number;
  shareBoard?: boolean | null;
}

export function boardLabel(name: string | null | undefined, school: string | null | undefined): string {
  const person = publicLabel(name);
  const place = (school ?? '').trim();
  return place ? `${person} · ${place}` : person;
}

export function leaderboardRows(people: readonly BoardPerson[], viewerId: string | null) {
  return [...people]
    .filter(person => person.shareBoard !== false)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map(person => ({
      id: person.id,
      label: boardLabel(person.name, person.school),
      score: person.score,
      isYou: person.id === viewerId,
    }));
}

export interface HouseScore {
  houseId: string;
  name: string;
  xp: number;
  members: number;
}

export function rankHouses(rows: readonly { houseId: string; houseName: string; xp: number; shareBoard?: boolean | null }[]): HouseScore[] {
  const map = new Map<string, HouseScore>();
  for (const row of rows) {
    if (row.shareBoard === false || !row.houseId) continue;
    const current = map.get(row.houseId) ?? { houseId: row.houseId, name: row.houseName || 'House', xp: 0, members: 0 };
    current.xp += Math.max(0, row.xp);
    current.members += 1;
    map.set(row.houseId, current);
  }
  return [...map.values()].sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
}

export interface ClassBoardSettings {
  leaderboardEnabled: boolean;
  competitionsEnabled: boolean;
}

/** Leaderboards stay available. House competitions stay off until a class turns them on. */
export function classBoards(value: { leaderboardEnabled?: boolean | null; competitionsEnabled?: boolean | null } | null | undefined): ClassBoardSettings {
  return {
    leaderboardEnabled: value?.leaderboardEnabled !== false,
    competitionsEnabled: value?.competitionsEnabled === true,
  };
}

export function definitionsFromConfig(raw: unknown): BadgeDefinition[] {
  if (!raw || typeof raw !== 'object') return mergeDefinitions([]);
  const badges = (raw as { badges?: unknown }).badges;
  return mergeDefinitions(Array.isArray(badges) ? badges as BadgeDefinitionInput[] : []);
}

export function sparksFromConfig(raw: unknown): SparksRewardConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SPARKS };
  const sparks = (raw as { sparks?: Partial<SparksRewardConfig> }).sparks;
  if (!sparks) return { ...DEFAULT_SPARKS };
  return {
    enabled: sparks.enabled === true,
    amount: Math.max(0, Math.min(SPARKS_AMOUNT_MAX, Math.floor(numberOf(sparks.amount)))),
    badgeIds: Array.isArray(sparks.badgeIds) ? sparks.badgeIds.filter((id): id is string => typeof id === 'string').slice(0, 40) : [],
  };
}
