import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { publicAchievementBadge } from '@/lib/server/achievement-badge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`badge:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const badge = await publicAchievementBadge(id, req.nextUrl.origin);
  if (!badge) return NextResponse.json({ error: 'No matching badge.', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(badge);
}
