/**
 * Push + in-app notices. deviceTokens/{deviceId} is the store the Expo app
 * and this web app share: userId, token, platform, provider expo|webpush, prefs.
 * The Admin SDK queries that collection by recipient userId. In-app
 * notifications are written either way, so a missing push token still lands
 * in the bell.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { goalPushAllowed } from '../parent-controls';
import { sendPush, type PushCategory } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';

export type PushPref =
  | 'goals'
  | 'streaks'
  | 'focus'
  | 'digest'
  | 'attendance'
  | 'integrity'
  | 'behaviour'
  | 'reports'
  | 'progress';

function categoryFor(pref: PushPref): PushCategory {
  if (pref === 'progress') return 'progress';
  if (pref === 'attendance') return 'attendance';
  if (pref === 'integrity') return 'flags';
  if (pref === 'digest' || pref === 'reports') return 'digests';
  if (pref === 'goals' || pref === 'streaks' || pref === 'focus') return 'goals';
  return 'general';
}

export interface NotifyPayload {
  userId: string;
  title: string;
  message: string;
  type: 'grade' | 'assignment' | 'announcement' | 'message' | 'exam' | 'integrity' | 'payment' | 'general';
  link?: string;
  pref: PushPref;
  skipPush?: boolean;
}

export async function parentIdsFor(studentId: string): Promise<string[]> {
  const snap = await adminDb().collection('users').where('childIds', 'array-contains', studentId).get();
  return snap.docs.map(doc => doc.id);
}

export async function notifyUser(payload: NotifyPayload): Promise<{ inApp: boolean; pushed: number; skipped: number }> {
  const db = adminDb();
  await db.collection('notifications').add({
    userId: payload.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    link: payload.link ?? '/dashboard',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (payload.skipPush) return { inApp: true, pushed: 0, skipped: 0 };

  const report = await sendPush({
    recipientUid: payload.userId,
    category: categoryFor(payload.pref),
    title: payload.title,
    body: payload.message,
    link: payload.link,
  }, { store: adminPushStore(), send: sendToDevice });
  return { inApp: true, pushed: report.sent, skipped: report.skipped };
}

export async function notifyParents(
  studentId: string,
  studentName: string,
  payload: Omit<NotifyPayload, 'userId'> ,
): Promise<number> {
  const parents = await parentIdsFor(studentId);
  const goalPref = payload.pref === 'goals' || payload.pref === 'focus' || payload.pref === 'streaks';
  await Promise.all(parents.map(async userId => {
    let skipPush = payload.skipPush === true;
    if (goalPref && !skipPush) {
      const controls = await adminDb().doc(`users/${userId}/child_controls/${studentId}`).get();
      if (controls.exists && !goalPushAllowed(controls.data() as { goalPush?: boolean })) skipPush = true;
    }
    await notifyUser({ ...payload, userId, skipPush, title: payload.title.replace('{name}', studentName) });
  }));
  return parents.length;
}
