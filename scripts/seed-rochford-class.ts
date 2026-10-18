/**
 * Writes the Rochford sample class once the Firebase Admin key exists.
 * Run: npx tsx scripts/seed-rochford-class.ts
 */
import { isAdminConfigured, adminDb } from '../lib/firebase-admin';
import { INSTITUTION_KEY_MESSAGE } from '../lib/institutions/rochford';
import { createDemoDesk } from '../lib/school-desk/model';

async function main() {
  if (!isAdminConfigured()) {
    console.log(INSTITUTION_KEY_MESSAGE);
    return;
  }
  const desk = createDemoDesk();
  const db = adminDb();
  const batch = db.batch();
  batch.set(db.collection('school_classes').doc(desk.classes[0].id), desk.classes[0]);
  for (const row of desk.enrolments) batch.set(db.collection('school_enrolments').doc(row.id), row);
  for (const row of desk.assessments) batch.set(db.collection('school_assessments').doc(row.id), row);
  for (const row of desk.marks) batch.set(db.collection('school_marks').doc(row.id), row);
  for (const row of desk.attendance) batch.set(db.collection('school_attendance').doc(row.id), row);
  for (const row of desk.goals) batch.set(db.collection('users').doc(row.studentId).collection('goals').doc(row.id), row);
  await batch.commit();
  console.log(`Seeded ${desk.classes[0].name} for ${desk.institution.name}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not seed the sample class.');
  process.exitCode = 1;
});
