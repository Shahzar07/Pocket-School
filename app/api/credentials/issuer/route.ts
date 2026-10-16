import { NextRequest, NextResponse } from 'next/server';
import { issuerDocument } from '@/lib/server/badge-issue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return NextResponse.json(await issuerDocument(req.nextUrl.origin), {
    headers: { 'Content-Type': 'application/ld+json; charset=utf-8' },
  });
}
