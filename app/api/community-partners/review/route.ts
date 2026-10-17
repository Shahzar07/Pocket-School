import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { reviewPartnerApplication } from '@/lib/server/community-partners';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; decision?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  const decision = body.decision === 'approved' || body.decision === 'declined' ? body.decision : '';
  if (!decision) return NextResponse.json({ error: 'Choose approve or decline.', code: 'BAD_REQUEST' }, { status: 400 });
  try {
    return NextResponse.json(await reviewPartnerApplication(user.uid, id, decision));
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
