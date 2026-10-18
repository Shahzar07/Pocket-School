/**
 * Writes the Rochford sample class once, and only when that class is missing.
 * Run: npx tsx scripts/seed-rochford-class.ts
 */
import { isAdminConfigured } from '../lib/firebase-admin';
import { INSTITUTION_KEY_MESSAGE } from '../lib/institutions/rochford';
import { seedRochfordClassIfMissing } from '../lib/school-desk/seed-rochford';

async function main() {
  if (!isAdminConfigured()) {
    console.log(INSTITUTION_KEY_MESSAGE);
    return;
  }
  const result = await seedRochfordClassIfMissing();
  if (!result.written) {
    console.log(`${result.name} is already on the school record. Nothing written.`);
    return;
  }
  console.log(`Seeded ${result.name}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not seed the sample class.');
  process.exitCode = 1;
});
