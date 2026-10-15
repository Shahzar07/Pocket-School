import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { assertPlacement } from '@/lib/programmes';
import { ActionError } from '@/lib/server/actions';
import { runPost } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Save a programme and year only when the pair matches the CMS taxonomy. */
export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    let placement;
    try {
      placement = assertPlacement(text(body.programme), text(body.year));
    } catch (error) {
      throw new ActionError('VALIDATION', error instanceof Error ? error.message : 'Choose a programme from the list.');
    }
    await adminDb().doc(`users/${user.uid}`).set({
      pathway: placement.pathway,
      level: placement.level,
      yearGroup: placement.yearGroup,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, ...placement };
  });
}
