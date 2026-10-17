/**
 * Off-site Firestore export for hotline and emergency records.
 * DISABLED by default. The Firebase Blaze plan is required before this can
 * write to a locked bucket with a retention policy. Pending Harry's approval.
 * This route is not listed in vercel.json, so nothing schedules it.
 */

export const BACKUP_ENABLED = process.env.FIRESTORE_BACKUP_ENABLED === 'true';

export const BACKUP_BUCKET = process.env.FIRESTORE_BACKUP_BUCKET || '';

export async function scheduledFirestoreExport(): Promise<{
  enabled: false;
  pendingApproval: true;
  plan: 'blaze';
  reason: string;
} | {
  enabled: true;
  bucket: string;
  outputUri: string;
}> {
  if (!BACKUP_ENABLED || !BACKUP_BUCKET) {
    return {
      enabled: false,
      pendingApproval: true,
      plan: 'blaze',
      reason: 'Disabled until Harry approves a Blaze-plan export to a locked retention bucket.',
    };
  }
  const outputUri = `gs://${BACKUP_BUCKET}/hotline-emergency/${new Date().toISOString().slice(0, 10)}`;
  return { enabled: true, bucket: BACKUP_BUCKET, outputUri };
}
