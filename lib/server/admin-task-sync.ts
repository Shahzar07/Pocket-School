/**
 * Opens and closes admin_tasks for queues that are not all written on the server.
 * Each query is limited and isolated, so one missing index does not stop the others.
 * Rules and indexes in this repo are not deployed from here.
 */
import 'server-only';
import { type Firestore } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '../firebase-admin';
import { draftForDocument, sourceResolved } from '../admin/task-sources';
import { ADMIN_TASKS, parseAdminTask } from '../admin/tasks';
import { finishAdminTask, rememberAdminTask } from './admin-tasks';

const LIMIT = 40;
let syncedAt = 0;

function db(): Firestore {
  return adminDb();
}

async function scan(
  label: string,
  run: () => Promise<FirebaseFirestore.QuerySnapshot>,
): Promise<number> {
  try {
    const snap = await run();
    let opened = 0;
    for (const doc of snap.docs) {
      const draft = draftForDocument(doc.ref.path, doc.data());
      if (!draft) continue;
      await rememberAdminTask(draft);
      opened += 1;
    }
    return opened;
  } catch (error) {
    console.error('admin task sync skipped', label, error instanceof Error ? error.message : error);
    return 0;
  }
}

async function closeResolved(): Promise<number> {
  const snap = await db().collection(ADMIN_TASKS).where('status', 'in', ['open', 'claimed', 'snoozed']).limit(100).get();
  let closed = 0;
  for (const doc of snap.docs) {
    const task = parseAdminTask(doc.id, doc.data());
    if (!task) continue;
    try {
      const source = await db().doc(task.entityPath).get();
      if (!source.exists || !sourceResolved(task.entityType, source.data() ?? {})) continue;
      await finishAdminTask(task.entityPath, 'system', 'done');
      closed += 1;
    } catch (error) {
      console.error('admin task close skipped', task.entityPath, error instanceof Error ? error.message : error);
    }
  }
  return closed;
}

export async function syncPendingAdminTasks(force = false): Promise<{ opened: number; closed: number; skipped?: boolean }> {
  if (!isAdminConfigured()) return { opened: 0, closed: 0, skipped: true };
  const now = Date.now();
  if (!force && now - syncedAt < 60_000) return { opened: 0, closed: 0, skipped: true };
  syncedAt = now;
  const database = db();
  const opened = (await Promise.all([
    scan('join', () => database.collectionGroup('join_requests').where('status', '==', 'pending').limit(LIMIT).get()),
    scan('hotline', () => database.collection('hotline_tickets').orderBy('createdAt', 'desc').limit(LIMIT).get()),
    scan('amber', () => database.collection('emergency_alerts').where('type', '==', 'missing_child').limit(LIMIT).get()),
    scan('reports', () => database.collection('reports').where('status', '==', 'open').limit(LIMIT).get()),
    scan('appeals', () => database.collection('moderation_appeals').where('status', '==', 'open').limit(LIMIT).get()),
    scan('moderation', () => database.collection('moderation_queue').limit(LIMIT).get()),
    scan('institutions', () => database.collection('institutions').where('status', '==', 'pending').limit(LIMIT).get()),
    scan('community', () => database.collection('communityPartnerApplications').where('status', '==', 'pending').limit(LIMIT).get()),
    scan('partners', () => database.collection('partners').where('status', '==', 'pending').limit(LIMIT).get()),
    scan('offers', () => database.collection('offers').where('status', '==', 'review').limit(LIMIT).get()),
    scan('courses', () => database.collection('courses').where('status', '==', 'pending_approval').limit(LIMIT).get()),
    scan('refunds', () => database.collection('refund_requests').where('status', '==', 'requested').limit(LIMIT).get()),
    scan('payouts', () => database.collection('payouts').where('status', 'in', ['transfer_failed', 'awaiting_connect']).limit(LIMIT).get()),
    scan('support', () => database.collection('support_tickets').where('status', 'in', ['open', 'in_progress']).limit(LIMIT).get()),
    scan('school-bills', () => database.collectionGroup('billing').where('phase', 'in', ['grace', 'suspended']).limit(LIMIT).get()),
    scan('subscriber-bills', () => database.collection('subscriber_billing').where('phase', 'in', ['grace', 'suspended']).limit(LIMIT).get()),
  ])).reduce((sum, count) => sum + count, 0);
  const closed = await closeResolved().catch(error => {
    console.error('admin task close failed', error instanceof Error ? error.message : error);
    return 0;
  });
  return { opened, closed };
}
