import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { LEARNING_EVENTS } from '@/lib/events';
import { isSuperAdminEmail } from '@/lib/roles';
import { adminPushStore } from '@/lib/push-store';
import { sendPush } from '@/lib/push';
import { sendToDevice } from '@/lib/push-transport';
import { onLearningEvent, type LearningEmission } from '@/lib/server/learning-events';
import {
  boardLabel,
  classBoards,
  definitionsFromConfig,
  emptyGameState,
  evaluateEvent,
  isoWeekKey,
  sparksFromConfig,
  type ClassBoardSettings,
  type Evaluation,
  type GameEvent,
  type GameState,
} from '@/lib/gamification/engine';

function asState(raw: FirebaseFirestore.DocumentData | undefined, xp: number): GameState {
  const base = emptyGameState(xp);
  if (!raw) return base;
  const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const map = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'number' && Number.isFinite(item)) out[key] = item;
    }
    return out;
  };
  return {
    ...base,
    xp: typeof raw.xp === 'number' ? raw.xp : xp,
    awarded: list(raw.awarded),
    counts: map(raw.counts),
    metrics: map(raw.metrics),
    dailyXp: map(raw.dailyXp),
    weeklyXp: map(raw.weeklyXp),
    dailyEvent: map(raw.dailyEvent),
    passedUnits: list(raw.passedUnits),
    comebacks: list(raw.comebacks),
    books: list(raw.books),
    weeks: list(raw.weeks),
    seen: list(raw.seen),
    streak: typeof raw.streak === 'number' ? raw.streak : 0,
    lastStudyDate: typeof raw.lastStudyDate === 'string' ? raw.lastStudyDate : '',
    freezes: typeof raw.freezes === 'number' ? raw.freezes : 0,
    freezeGrants: list(raw.freezeGrants),
    quests: map(raw.quests),
    questsDone: list(raw.questsDone),
    integrityFlags: typeof raw.integrityFlags === 'number' ? raw.integrityFlags : 0,
    sparksPaid: list(raw.sparksPaid),
  };
}

export async function readGameSummary(uid: string) {
  const db = adminDb();
  const [snap, userSnap] = await Promise.all([
    db.doc(`gamification/${uid}`).get(),
    db.doc(`users/${uid}`).get(),
  ]);
  const profileXp = userSnap.data()?.xp;
  const state = asState(snap.data(), typeof profileXp === 'number' ? profileXp : 0);
  return {
    xp: state.xp,
    awarded: state.awarded,
    counts: state.counts,
    dailyXp: state.dailyXp,
    weeklyXp: state.weeklyXp,
    passedUnits: state.passedUnits,
    streak: state.streak,
    freezes: state.freezes,
    quests: state.quests,
    questsDone: state.questsDone,
  };
}

function achievementsPushAllowed(user: FirebaseFirestore.DocumentData): boolean {
  const prefs = user.notificationPrefs;
  if (!prefs || typeof prefs !== 'object') return true;
  const row = prefs as { push?: unknown; achievements?: unknown };
  return row.push !== false && row.achievements !== false;
}

async function notifyAchievements(uid: string, user: FirebaseFirestore.DocumentData, result: Evaluation) {
  const notes: { title: string; message: string; link: string }[] = [];
  for (const badge of result.badges) {
    notes.push({
      title: 'New badge',
      message: badge.name,
      link: `/badges/${uid}_${badge.id}`,
    });
  }
  if (result.leveledUp) {
    notes.push({
      title: 'Level up',
      message: result.levelName,
      link: '/dashboard/student/achievements',
    });
  }
  for (const quest of result.questsCompleted) {
    notes.push({
      title: 'Quest complete',
      message: quest.title,
      link: '/dashboard/student/achievements',
    });
  }
  if (!notes.length) return;
  const pushOn = achievementsPushAllowed(user);
  const db = adminDb();
  for (const note of notes) {
    await db.collection('notifications').add({
      userId: uid,
      title: note.title,
      message: note.message,
      type: 'general',
      link: note.link,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (!pushOn) continue;
    await sendPush({
      recipientUid: uid,
      category: 'achievements',
      title: note.title,
      body: note.message,
      link: note.link,
    }, { store: adminPushStore(), send: sendToDevice });
  }
}

export async function applyLearningEvent(uid: string, input: GameEvent) {
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const stateRef = db.doc(`gamification/${uid}`);
  const [userSnap, stateSnap, configSnap] = await Promise.all([
    userRef.get(),
    stateRef.get(),
    db.doc('gamification_config/settings').get(),
  ]);
  const user = userSnap.data() ?? {};
  const currentXp = typeof user.xp === 'number' ? user.xp : 0;
  const result = evaluateEvent(
    asState(stateSnap.data(), currentXp),
    input,
    definitionsFromConfig(configSnap.data()),
    sparksFromConfig(configSnap.data()),
  );
  await stateRef.set({ ...result.state, updatedAt: FieldValue.serverTimestamp() });
  for (const badge of result.badges) {
    await db.doc(`badges/${uid}_${badge.id}`).set({
      userId: uid,
      type: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      art: FieldValue.delete(),
      tier: badge.tier,
      audience: badge.audience,
      awardedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  if (result.xpGained > 0) {
    await userRef.set({ xp: result.state.xp, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  if (result.sparks > 0) {
    const balance = (typeof user.sparksBalance === 'number' ? user.sparksBalance : 0) + result.sparks;
    await userRef.set({ sparksBalance: balance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await userRef.collection('spark_transactions').doc().set({
      amount: result.sparks,
      type: 'earn',
      balanceAfter: balance,
      note: 'Badge milestone',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await writeBoards(uid, user, result.state, input.day);
  if (!result.skipped) {
    try {
      await notifyAchievements(uid, user, result);
    } catch (error) {
      console.error('[gamification] achievements push', error);
    }
  }
  return {
    xpGained: result.xpGained,
    xp: result.state.xp,
    levelName: result.levelName,
    leveledUp: result.leveledUp,
    badges: result.badges.map(badge => ({ id: badge.id, name: badge.name, icon: badge.icon, tier: badge.tier })),
    questsCompleted: result.questsCompleted.map(quest => quest.id),
    sparks: result.sparks,
    freezes: result.state.freezes,
    freezeEarned: result.freezeEarned,
    celebrate: result.celebrate,
    skipped: result.skipped,
  };
}

let serverEventsListening = false;

/** Applies events the server emits. Clients never post `lesson.first_complete`. */
export function listenForServerEvents(): void {
  if (serverEventsListening) return;
  serverEventsListening = true;
  onLearningEvent(async (emission: LearningEmission) => {
    if (emission.event !== LEARNING_EVENTS.lessonFirstComplete) return;
    if (!isAdminConfigured()) return;
    await applyLearningEvent(emission.uid, {
      event: emission.event,
      day: emission.day,
      eventId: emission.eventId ?? `lesson-first:${emission.uid}`,
      payload: emission.payload ?? {},
    });
  });
}

async function writeBoards(
  uid: string,
  user: FirebaseFirestore.DocumentData,
  state: GameState,
  day: string,
) {
  if (user.shareBoard === false) return;
  const db = adminDb();
  const classId = typeof user.classId === 'string' ? user.classId : Array.isArray(user.cohortIds) ? String(user.cohortIds[0] ?? '') : '';
  const institutionId = typeof user.institutionId === 'string' ? user.institutionId : '';
  const houseId = typeof user.houseId === 'string' ? user.houseId : '';
  const school = typeof user.schoolName === 'string' ? user.schoolName : '';
  const name = typeof user.name === 'string' ? user.name : '';
  let settings = classBoards(null);
  if (institutionId && classId) {
    const klass = await db.doc(`institutions/${institutionId}/classes/${classId}`).get();
    settings = classBoards(klass.data());
  }
  const week = isoWeekKey(day);
  const scopes: { scope: string; scopeId: string; enabled: boolean }[] = [
    { scope: 'class', scopeId: classId, enabled: Boolean(classId) && settings.leaderboardEnabled },
    { scope: 'institution', scopeId: institutionId, enabled: Boolean(institutionId) && settings.leaderboardEnabled },
    { scope: 'house', scopeId: houseId, enabled: Boolean(houseId) && settings.competitionsEnabled },
  ];
  for (const scope of scopes) {
    if (!scope.enabled) continue;
    for (const period of [week, 'all']) {
      await db.doc(`leaderboard_entries/${uid}_${scope.scope}_${period}`).set({
        userId: uid,
        scope: scope.scope,
        scopeId: scope.scopeId,
        period,
        xp: period === 'all' ? state.xp : (state.weeklyXp[week] ?? 0),
        label: boardLabel(name, school),
        schoolName: school,
        shareBoard: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
}

export async function readBoard(scope: string, scopeId: string, period: string) {
  const snap = await adminDb().collection('leaderboard_entries')
    .where('scope', '==', scope)
    .where('scopeId', '==', scopeId)
    .where('period', '==', period)
    .orderBy('xp', 'desc')
    .limit(20)
    .get();
  return snap.docs.map(row => {
    const data = row.data();
    return {
      id: typeof data.userId === 'string' ? data.userId : row.id,
      label: typeof data.label === 'string' ? data.label : 'Learner',
      score: typeof data.xp === 'number' ? data.xp : 0,
    };
  });
}

export async function saveClassBoards(actorUid: string, institutionId: string, classId: string, settings: ClassBoardSettings) {
  const db = adminDb();
  const actor = (await db.doc(`users/${actorUid}`).get()).data() ?? {};
  const role = typeof actor.role === 'string' ? actor.role : '';
  const roles = Array.isArray(actor.roles) ? actor.roles.filter((item): item is string => typeof item === 'string') : [];
  const staff = role === 'admin' || role === 'teacher' || role === 'institution_admin'
    || roles.includes('teacher') || roles.includes('institution_admin');
  const sameSchool = role === 'admin' || actor.institutionId === institutionId;
  if (!staff || !sameSchool) {
    const error = new Error('You cannot change this class.');
    (error as Error & { code?: string }).code = 'FORBIDDEN';
    throw error;
  }
  await db.doc(`institutions/${institutionId}/classes/${classId}`).set({
    leaderboardEnabled: settings.leaderboardEnabled,
    competitionsEnabled: settings.competitionsEnabled,
  }, { merge: true });
}

export async function assertSuperAdmin(uid: string, email?: string) {
  const data = (await adminDb().doc(`users/${uid}`).get()).data() ?? {};
  const role = typeof data.role === 'string' ? data.role : '';
  const adminRole = typeof data.adminRole === 'string' ? data.adminRole : '';
  if (role === 'admin' || adminRole === 'super_admin' || isSuperAdminEmail(email)) return;
  const error = new Error('Super admin access required.');
  (error as Error & { code?: string }).code = 'FORBIDDEN';
  throw error;
}
