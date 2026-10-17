import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { amberReceiveAllowed } from '@/lib/amber/public';
import { setAmberOptIn } from '@/lib/server/amber';
import { ActionError } from '@/lib/server/actions';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest) {
  amberReceiveAllowed();
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const result = await setAmberOptIn(user.uid, {
      country: str(body.country),
      state: str(body.state),
      city: str(body.city),
      homeCountry: str(body.homeCountry),
      optIn: body.optIn === false ? false : true,
      referral: str(body.referral),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
