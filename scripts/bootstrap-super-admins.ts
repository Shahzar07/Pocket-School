/**
 * Seed the initial super admins.
 *
 *   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
 *   export ADMIN_BOOTSTRAP_EMAILS='harry.seggu@gmail.com,shahzarrayyan123@gmail.com'
 *   npx tsx scripts/bootstrap-super-admins.ts
 *
 * ADMIN_BOOTSTRAP_EMAILS is optional. The two owner emails are always included.
 * Each person signs out and back in after this so the ID token picks up the claim.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { initialSuperAdmin, parseBootstrapEmails } from '../lib/admin-console';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT to the owner service-account JSON.');
  process.exit(1);
}

const emails = parseBootstrapEmails(process.env.ADMIN_BOOTSTRAP_EMAILS);
const app = initializeApp({
  credential: cert(JSON.parse(serviceAccount) as Record<string, string>),
});
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let failed = 0;
for (const email of emails) {
  try {
    const user = await auth.getUserByEmail(email);
    const known = initialSuperAdmin(email);
    await auth.setCustomUserClaims(user.uid, { adminRole: 'super_admin', role: 'admin' });
    await db.collection('users').doc(user.uid).set({
      email,
      role: 'admin',
      adminRole: 'super_admin',
      ...(known ? { name: known.name } : {}),
    }, { merge: true });
    console.log(`super admin ${email} (${user.uid})`);
  } catch (err) {
    failed += 1;
    console.error(`could not seed ${email}:`, err instanceof Error ? err.message : err);
  }
}

if (failed) process.exit(1);
console.log(`Seeded ${emails.length} super admin claim${emails.length === 1 ? '' : 's'}. Sign out and in again on each account.`);
