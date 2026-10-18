/**
 * Creates Rochford's International School once the Firebase Admin key exists.
 * The same fixture is available from the institutions screen.
 * Run: npx tsx scripts/seed-rochford.ts
 */
import { isAdminConfigured } from '../lib/firebase-admin';
import { INSTITUTION_KEY_MESSAGE } from '../lib/institutions/rochford';
import { createPlatformInstitution, draftFromRochford } from '../lib/server/institution-create';

async function main() {
  if (!isAdminConfigured()) {
    console.log(INSTITUTION_KEY_MESSAGE);
    return;
  }
  const result = await createPlatformInstitution(draftFromRochford('seed-rochford'));
  console.log(result.created ? `Created ${result.id}` : `Already present ${result.id}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not create the test school.');
  process.exitCode = 1;
});
