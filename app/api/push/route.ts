import { NextRequest, NextResponse } from 'next/server';
import { parsePushRequest } from '@/lib/platform/push';

export const dynamic = 'force-dynamic';

/**
 * Shared push body. Delivery needs the web-push sender, which is not on
 * this branch, so a valid request is accepted and not sent.
 */
export async function POST(req: NextRequest) {
  const parsed = parsePushRequest(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ sent: 0, pruned: [], pending: true });
}
