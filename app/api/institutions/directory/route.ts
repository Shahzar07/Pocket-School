import { NextRequest, NextResponse } from 'next/server';
import { listPublicInstitutions, lookupInviteCode } from '@/lib/server/public-directory';

export const dynamic = 'force-dynamic';

/** Signed-out school search. Returns display fields only. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  if (code.trim()) {
    const found = await lookupInviteCode(code);
    return NextResponse.json(found);
  }
  const result = await listPublicInstitutions({
    country: req.nextUrl.searchParams.get('country') ?? '',
    state: req.nextUrl.searchParams.get('state') ?? '',
    q: req.nextUrl.searchParams.get('q') ?? '',
  });
  return NextResponse.json(result);
}
