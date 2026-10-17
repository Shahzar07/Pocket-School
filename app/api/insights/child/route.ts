import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { reconcileUser } from '@/lib/server/insight-counters';
import { parseGender } from '@/lib/insights/census';

export const dynamic = 'force-dynamic';

/** A linked parent saves grouped demographics for an under-13 child. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const profile = await loadUser(user.uid);
  const childIds = Array.isArray(profile?.childIds) ? profile.childIds.filter((id): id is string => typeof id === 'string') : [];
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const childId = typeof body.childId === 'string' ? body.childId : '';
  if (!childIds.includes(childId)) {
    return NextResponse.json({ error: 'That child is not linked to this parent.', code: 'FORBIDDEN' }, { status: 403 });
  }
  if (body.demographicConsent !== true) {
    return NextResponse.json({ error: 'Confirm the demographic statistics notice.', code: 'VALIDATION' }, { status: 400 });
  }
  const gender = parseGender(body.gender);
  if (body.gender && !gender) {
    return NextResponse.json({ error: 'Choose male or female.', code: 'VALIDATION' }, { status: 400 });
  }
  await reconcileUser(childId, {
    gender,
    country: typeof body.country === 'string' ? body.country : '',
    region: typeof body.region === 'string' ? body.region : '',
    level: typeof body.level === 'string' ? body.level : '',
    yearGroup: typeof body.yearGroup === 'string' ? body.yearGroup : '',
    dateOfBirth: typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '',
    demographicConsent: true,
  });
  return NextResponse.json({ ok: true });
}
