/**
 * Preview QA accounts for Harry's Sunday pass.
 *
 *   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
 *   npx tsx scripts/seed-test-accounts.ts
 *
 * Writes to the named database in firebase-applet-config.json.
 * Does not create a super admin. Super admins stay the three owner emails.
 * Safe to run again: existing emails keep their uid and the profile is merged.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const PASSWORD = 'Poket-QA-Sunday-2026';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT to the owner service-account JSON, then run this again.');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(serviceAccount) as Record<string, string>),
});
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function ensureUser(email: string, displayName: string): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password: PASSWORD, displayName, emailVerified: true });
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email,
      password: PASSWORD,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

const institutionId = 'qa-poket-academy';

const studentId = await ensureUser('student.qa@poketschool.ai', 'QA Student');
const teacherId = await ensureUser('teacher.qa@poketschool.ai', 'QA Teacher');
const parentId = await ensureUser('parent.qa@poketschool.ai', 'QA Parent');
const institutionAdminId = await ensureUser('institution.qa@poketschool.ai', 'QA Institution');
const tutorId = await ensureUser('tutor.qa@poketschool.ai', 'QA Tutor');

await db.collection('institutions').doc(institutionId).set({
  name: 'QA Poket Academy',
  status: 'active',
  studentCount: 1,
  teacherCount: 1,
  adminId: institutionAdminId,
}, { merge: true });

await db.collection('users').doc(studentId).set({
  name: 'QA Student',
  email: 'student.qa@poketschool.ai',
  role: 'student',
  roles: ['student'],
  accountStatus: 'active',
  xp: 0,
  sparksBalance: 40,
  institutionId,
}, { merge: true });

await db.collection('users').doc(teacherId).set({
  name: 'QA Teacher',
  email: 'teacher.qa@poketschool.ai',
  role: 'teacher',
  roles: ['student', 'teacher'],
  accountStatus: 'active',
  xp: 0,
  sparksBalance: 0,
  institutionId,
}, { merge: true });

await db.collection('users').doc(parentId).set({
  name: 'QA Parent',
  email: 'parent.qa@poketschool.ai',
  role: 'parent',
  roles: ['student', 'parent'],
  accountStatus: 'active',
  xp: 0,
  sparksBalance: 0,
  childIds: [studentId],
}, { merge: true });

await db.collection('users').doc(institutionAdminId).set({
  name: 'QA Institution',
  email: 'institution.qa@poketschool.ai',
  role: 'institution_admin',
  accountStatus: 'active',
  xp: 0,
  sparksBalance: 0,
  institutionId,
}, { merge: true });

await db.collection('users').doc(tutorId).set({
  name: 'QA Tutor',
  email: 'tutor.qa@poketschool.ai',
  role: 'teacher',
  roles: ['student', 'teacher'],
  accountStatus: 'active',
  xp: 0,
  sparksBalance: 0,
  tutor: true,
}, { merge: true });

console.log('QA accounts ready. Password is in TESTING.md. Super admin is not seeded here.');
console.log({ studentId, teacherId, parentId, institutionAdminId, tutorId, institutionId });
