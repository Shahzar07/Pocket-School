import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { identityMode } from '@/lib/enterprise';

/** Booleans only. Secret values never leave the server. */
export async function GET(req: NextRequest) {
  const caller = await requireUser(req);
  if (isNextResponse(caller)) return caller;
  return NextResponse.json(identityMode(process.env));
}
