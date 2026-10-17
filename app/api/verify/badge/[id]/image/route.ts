import { NextRequest, NextResponse } from 'next/server';
import { achievementBadgePng } from '@/lib/server/achievement-badge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const png = await achievementBadgePng(id, req.nextUrl.origin);
  if (!png) return NextResponse.json({ error: 'No matching badge.', code: 'NOT_FOUND' }, { status: 404 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
