import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { INSTITUTION_KEY_MESSAGE } from '@/lib/institutions/rochford';
import { createPlatformInstitution, draftFromBody } from '@/lib/server/institution-create';
import { loadToolActor } from '@/lib/server/tool-actor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, comingSoon: true, error: INSTITUTION_KEY_MESSAGE }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (actor.staff !== 'super_admin') {
    return NextResponse.json({ error: 'Only a super admin can add an institution.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const draft = draftFromBody(body, actor.uid);
  if (!draft.ok) return NextResponse.json({ error: draft.error }, { status: 400 });
  try {
    const result = await createPlatformInstitution(draft.value);
    return NextResponse.json({ ok: true, ...result, name: draft.value.name });
  } catch (error) {
    console.error('Institution create failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not create that institution.' }, { status: 500 });
  }
}
