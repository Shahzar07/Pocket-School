import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { memberShareResponse } from '@/lib/server/linkedin-auth';

export const dynamic = 'force-dynamic';

/** Member posts stay off until LinkedIn approves w_member_social. This route does not call LinkedIn. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  return NextResponse.json(memberShareResponse(), { status: 403 });
}
