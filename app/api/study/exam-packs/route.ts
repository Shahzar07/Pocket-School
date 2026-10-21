import { errorResponse, requireUser } from '@/lib/server-auth';
import { publishedCatalog } from '@/lib/study/pack-server';

/** Signed-in catalogue: built-in packs, with published Firestore packs overlaid. */
export async function GET(req: Request) {
  try {
    await requireUser(req);
    return Response.json({ packs: await publishedCatalog() });
  } catch (err) {
    return errorResponse(err, 'Could not load exam packs.');
  }
}
