import { NextRequest, NextResponse } from 'next/server';
import { ActionError } from '@/lib/server/actions';
import { acknowledgeSchoolNotice } from '@/lib/server/school-notice';

export const dynamic = 'force-dynamic';

/** Public acknowledgement. The token is the credential. No account is required. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; actionTaken?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  const actionTaken = typeof body.actionTaken === 'string' ? body.actionTaken : '';
  try {
    return NextResponse.json(await acknowledgeSchoolNotice(token, actionTaken));
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
