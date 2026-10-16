import 'server-only';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import {
  activityDocument,
  clampRetention,
  DEFAULT_RETENTION_DAYS,
  retentionCutoff,
  type ActivityDraft,
  type ActivityEvent,
} from './model';

export async function recordActivity(input: ActivityDraft): Promise<void> {
  if (!isAdminConfigured()) return;
  const event = activityDocument(input);
  const db = adminDb();
  const ref = db.collection('activity_log').doc();
  const batch = db.batch();
  batch.set(ref, event);
  if (event.category === 'auth' && event.actorId && event.actorId !== 'anonymous') {
    batch.set(db.doc(`users/${event.actorId}/auth_activity/${ref.id}`), event);
  }
  await batch.commit();
}

export async function listActivity(max = 500): Promise<(ActivityEvent & { id: string })[]> {
  const snap = await adminDb().collection('activity_log').orderBy('at', 'desc').limit(max).get();
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as ActivityEvent) }));
}

export async function listOwnAuth(actorId: string): Promise<(ActivityEvent & { id: string })[]> {
  const snap = await adminDb()
    .collection('users')
    .doc(actorId)
    .collection('auth_activity')
    .orderBy('at', 'desc')
    .limit(50)
    .get();
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as ActivityEvent) }));
}

export async function getRetentionDays(): Promise<number> {
  if (!isAdminConfigured()) return DEFAULT_RETENTION_DAYS;
  const snap = await adminDb().doc('audit_settings/retention').get();
  const days = snap.data()?.days;
  return typeof days === 'number' ? clampRetention(days) : DEFAULT_RETENTION_DAYS;
}

export async function setRetentionDays(input: ActivityDraft & { days: number }): Promise<number> {
  const next = clampRetention(input.days);
  const current = await getRetentionDays();
  await adminDb().doc('audit_settings/retention').set({
    days: next,
    updatedAt: Date.now(),
    updatedBy: input.actorId,
  });
  await recordActivity({
    ...input,
    action: 'retention.set',
    targetType: 'audit_settings',
    targetId: 'retention',
    before: { days: current },
    after: { days: next },
  });
  return next;
}

/** Deletes events older than the retention window. This is the only delete path. */
export async function purgeExpiredActivity(input: ActivityDraft): Promise<{ removed: number; days: number }> {
  const days = await getRetentionDays();
  const cutoff = retentionCutoff(days, Date.now());
  const db = adminDb();
  const old = await db.collection('activity_log').where('at', '<', cutoff).limit(400).get();
  const batch = db.batch();
  old.docs.forEach((item) => batch.delete(item.ref));
  if (!old.empty) await batch.commit();
  try {
    const copies = await db.collectionGroup('auth_activity').where('at', '<', cutoff).limit(400).get();
    if (!copies.empty) {
      const extra = db.batch();
      copies.docs.forEach((item) => extra.delete(item.ref));
      await extra.commit();
    }
  } catch (error) {
    console.error('[audit] login-activity purge needs the collection-group index', error);
  }
  await recordActivity({
    ...input,
    action: 'retention.purge',
    targetType: 'activity_log',
    targetId: 'retention',
    after: { removed: old.size, cutoff, days },
  });
  return { removed: old.size, days };
}
