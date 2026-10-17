import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { MyInvoisDocument } from '../tax';
import {
  MYINVOIS_MAX_ATTEMPTS,
  myInvoisEnv,
  nextRetryAt,
  shouldRetry,
  submissionBody,
  type MyInvoisStatus,
} from '../myinvois-submit';

interface QueueDoc {
  invoiceId: string;
  status: MyInvoisStatus;
  detail: string;
  attempts: number;
  nextAttemptAt: number | null;
  document: MyInvoisDocument;
  submissionUid?: string;
}

function queueRef(invoiceId: string) {
  return adminDb().doc(`myinvois_queue/${invoiceId}`);
}

async function accessToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'InvoicingAPI',
  });
  const response = await fetch(`${host}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`MyInvois token ${response.status}`);
  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error('MyInvois token was empty.');
  return json.access_token;
}

async function submitOne(row: QueueDoc, now: number): Promise<QueueDoc> {
  const env = myInvoisEnv();
  if (!env.ready) {
    return { ...row, status: 'not_configured', detail: env.detail, nextAttemptAt: null };
  }
  const attempts = row.attempts + 1;
  try {
    const token = await accessToken(env.host, env.clientId, env.clientSecret);
    const response = await fetch(`${env.host}/api/v1.0/documentsubmissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submissionBody({
        ...row.document,
        supplier: { ...row.document.supplier, tin: env.tin },
      }, row.invoiceId)),
    });
    const json = await response.json().catch(() => ({})) as { submissionUid?: string; acceptedDocuments?: { uuid?: string }[] };
    if (response.ok) {
      const submissionUid = json.submissionUid || json.acceptedDocuments?.[0]?.uuid || '';
      return {
        ...row,
        status: 'submitted',
        detail: `Submitted to MyInvois ${env.mode}.`,
        attempts,
        nextAttemptAt: null,
        ...(submissionUid ? { submissionUid } : {}),
      };
    }
    const detail = `MyInvois returned ${response.status}.`;
    if (shouldRetry(response.status, attempts)) {
      return { ...row, status: 'retry', detail, attempts, nextAttemptAt: nextRetryAt(attempts, now) };
    }
    return { ...row, status: 'failed', detail, attempts, nextAttemptAt: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'MyInvois request failed.';
    if (attempts >= MYINVOIS_MAX_ATTEMPTS) {
      return { ...row, status: 'failed', detail, attempts, nextAttemptAt: null };
    }
    return { ...row, status: 'retry', detail, attempts, nextAttemptAt: nextRetryAt(attempts, now) };
  }
}

async function save(row: QueueDoc): Promise<void> {
  await queueRef(row.invoiceId).set({
    ...row,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await adminDb().doc(`invoices/${row.invoiceId}`).set({
    myInvoisStatus: row.status,
    myInvoisDetail: row.detail,
    ...(row.submissionUid ? { myInvoisSubmissionUid: row.submissionUid } : {}),
  }, { merge: true });
}

/** Stores a paid invoice for MyInvois and tries once. Missing keys leave a clear not_configured status. */
export async function enqueuePaidInvoice(invoiceId: string, document: MyInvoisDocument): Promise<MyInvoisStatus> {
  const now = Date.now();
  const env = myInvoisEnv();
  const base: QueueDoc = {
    invoiceId,
    status: 'queued',
    detail: 'Waiting to submit.',
    attempts: 0,
    nextAttemptAt: now,
    document,
  };
  if (!env.ready) {
    const skipped = { ...base, status: 'not_configured' as const, detail: env.detail, nextAttemptAt: null };
    await save(skipped);
    return skipped.status;
  }
  const result = await submitOne(base, now);
  await save(result);
  return result.status;
}

/** Retries due items. Safe to call from the daily cron. */
export async function processMyInvoisQueue(now = Date.now()): Promise<{ checked: number; submitted: number }> {
  const snap = await adminDb().collection('myinvois_queue').where('status', '==', 'retry').limit(20).get();
  let submitted = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as QueueDoc;
    if (typeof data.nextAttemptAt === 'number' && data.nextAttemptAt > now) continue;
    const result = await submitOne({ ...data, invoiceId: doc.id }, now);
    await save(result);
    if (result.status === 'submitted') submitted += 1;
  }
  return { checked: snap.size, submitted };
}
