import { NextRequest, NextResponse } from 'next/server';
import { badgeById, badgeCardSvg } from '@/lib/gamification/card-svg';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('badge') ?? '';
  const badge = badgeById(id);
  if (!badge) return NextResponse.json({ error: 'Badge not found.', code: 'NOT_FOUND' }, { status: 404 });
  const earner = (req.nextUrl.searchParams.get('earner') ?? 'Learner').slice(0, 40);
  const school = (req.nextUrl.searchParams.get('school') ?? '').slice(0, 60);
  const svg = badgeCardSvg(badge, earner, school);
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
