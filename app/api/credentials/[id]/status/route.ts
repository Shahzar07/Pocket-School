import { NextRequest, NextResponse } from 'next/server';
import { credentialStatusDocument } from '@/lib/server/badge-issue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const status = await credentialStatusDocument(id, req.nextUrl.origin);
  if (!status) return NextResponse.json({ error: 'No matching certificate.', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(status);
}
