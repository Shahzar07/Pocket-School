import { NextRequest, NextResponse } from 'next/server';
import { publicCredential } from '@/lib/server/badge-issue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const credential = await publicCredential(id, req.nextUrl.origin);
  if (!credential) {
    return NextResponse.json({ error: 'No matching certificate.', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(credential, {
    headers: { 'Content-Type': 'application/ld+json; charset=utf-8' },
  });
}
